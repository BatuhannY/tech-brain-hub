import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Cache & Throttle ---
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 120_000; // 2min
let lastCallTs = 0;
const MIN_INTERVAL = 2_000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 50) { const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; if (oldest) cache.delete(oldest[0]); }
}
async function throttle() {
  const now = Date.now();
  const wait = MIN_INTERVAL - (now - lastCallTs);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTs = Date.now();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description, mode } = await req.json();

    if (!title && !description) {
      return new Response(JSON.stringify({ error: "Title or description required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `copilot:${mode}:${(title || '').trim().toLowerCase()}:${(description || '').trim().toLowerCase().slice(0, 80)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { data: existingIssues } = await supabase
      .from("issue_logs")
      .select("id, title, description, category, status, internal_fix, ai_suggested_fix, web_fix, solution_steps, report_count")
      .order("report_count", { ascending: false })
      .limit(100);

    const issues = existingIssues || [];

    if (mode === "suggest") {
      const issuesList = issues.map((i, idx) =>
        `[${idx}] "${i.title}" (${i.category}/${i.status}) - ${i.description || 'N/A'}`
      ).join("\n");

      await throttle();

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are a duplicate-detection and fix-suggestion agent. Given a new issue title, check the existing issues list for semantic matches. If a match exists with a fix, return it. If no match, generate a brief proposed draft fix based on general IT knowledge.

Existing issues:
${issuesList || "None yet"}`,
            },
            { role: "user", content: `New issue title: "${title}"${description ? `\nDescription: ${description}` : ''}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "copilot_suggest",
              description: "Return match info or draft fix",
              parameters: {
                type: "object",
                properties: {
                  match_found: { type: "boolean", description: "True if a semantically similar issue exists" },
                  match_index: { type: "number", description: "Index of matched issue or -1" },
                  match_title: { type: "string", description: "Title of matched issue if found" },
                  existing_fix: { type: "string", description: "The fix from the matched issue" },
                  proposed_draft_fix: { type: "string", description: "If no match, a brief proposed fix. Use bullet points." },
                  suggested_category: { type: "string", enum: ["Bug", "Network", "Access", "Hardware", "Software", "Security", "Other"] },
                },
                required: ["match_found", "match_index", "proposed_draft_fix", "suggested_category"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "copilot_suggest" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No AI response");

      const parsed = JSON.parse(toolCall.function.arguments);

      if (parsed.match_found && parsed.match_index >= 0 && parsed.match_index < issues.length) {
        const matched = issues[parsed.match_index];
        parsed.existing_fix = matched.internal_fix || matched.ai_suggested_fix || matched.web_fix || matched.solution_steps || "";
        parsed.match_title = matched.title;
        parsed.match_id = matched.id;
        parsed.match_status = matched.status;
      }

      setCache(cacheKey, parsed);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (mode === "draft") {
      await throttle();

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are an expert IT support agent. Generate a concise, actionable step-by-step fix for the described issue. Use bullet points. Focus on practical resolution steps. Do not describe the problem back.`,
            },
            { role: "user", content: `Issue: ${title}\nDescription: ${description || 'No description provided'}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_fix",
              description: "Generate resolution steps",
              parameters: {
                type: "object",
                properties: {
                  fix_steps: { type: "string", description: "Bullet-point resolution steps in HTML format using <ul><li> tags" },
                  category: { type: "string", enum: ["Bug", "Network", "Access", "Hardware", "Software", "Security", "Other"] },
                },
                required: ["fix_steps", "category"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_fix" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No AI response");

      const result = JSON.parse(toolCall.function.arguments);
      setCache(cacheKey, result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-copilot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

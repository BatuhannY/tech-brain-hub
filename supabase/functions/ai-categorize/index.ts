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
    const { title, description } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `cat:${title.trim().toLowerCase()}:${(description || '').trim().toLowerCase().slice(0, 100)}`;
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
      .select("id, title, description, category, report_count")
      .order("created_at", { ascending: false });

    const issuesList = (existingIssues || []).map((i, idx) =>
      `[${idx}] id:${i.id} | Title: ${i.title} | Category: ${i.category} | Description: ${i.description || 'N/A'}`
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
            content: `You are an IT support AI agent. You ONLY provide actionable fixes — never describe the bug back. Your tasks:
1. Assign a category from: Bug, Network, Access, Hardware, Software, Security, Other.
2. Check if any existing issue below is semantically the same problem (duplicate). Return its index or -1.
3. Generate an actionable ai_suggested_fix: step-by-step instructions to resolve this issue.
4. Generate a web_fix: simulate searching the web and provide the best known community solution with specific commands/steps.

Existing issues:
${issuesList || "None yet"}`,
          },
          { role: "user", content: `New issue:\nTitle: ${title}\nDescription: ${description || 'N/A'}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "categorize_issue",
            description: "Return categorization, duplicate detection, and fixes",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string", enum: ["Bug", "Network", "Access", "Hardware", "Software", "Security", "Other"] },
                duplicate_index: { type: "number", description: "Index of duplicate issue or -1 if none" },
                ai_suggested_fix: { type: "string", description: "Step-by-step actionable fix" },
                web_fix: { type: "string", description: "Best known web/community solution with specific steps" },
              },
              required: ["category", "duplicate_index", "ai_suggested_fix", "web_fix"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "categorize_issue" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required, please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No AI response received");

    const parsed = JSON.parse(toolCall.function.arguments);
    const { category, duplicate_index, ai_suggested_fix, web_fix } = parsed;

    let duplicateId: string | null = null;
    if (duplicate_index >= 0 && existingIssues && duplicate_index < existingIssues.length) {
      const dup = existingIssues[duplicate_index];
      duplicateId = dup.id;
      await supabase
        .from("issue_logs")
        .update({ report_count: (dup.report_count || 1) + 1 })
        .eq("id", dup.id);
    }

    const result = { category, ai_suggested_fix, web_fix, duplicate_id: duplicateId };
    setCache(cacheKey, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-categorize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

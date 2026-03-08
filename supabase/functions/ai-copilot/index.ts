// v3 - public access fix: verify_jwt=false redeployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description, mode } = await req.json();
    // mode: "suggest" (title typing) or "draft" (create with empty resolution)

    if (!title && !description) {
      return new Response(JSON.stringify({ error: "Title or description required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch existing issues with fixes for matching
    const { data: existingIssues } = await supabase
      .from("issue_logs")
      .select("id, title, description, category, status, internal_fix, ai_suggested_fix, web_fix, solution_steps, report_count")
      .order("report_count", { ascending: false })
      .limit(100);

    const issues = existingIssues || [];

    if (mode === "suggest") {
      // Check DB for similar issues — use AI to find semantic matches
      const issuesList = issues.map((i, idx) =>
        `[${idx}] "${i.title}" (${i.category}/${i.status}) - ${i.description || 'N/A'}`
      ).join("\n");

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
                  existing_fix: { type: "string", description: "The fix from the matched issue (internal_fix > ai_suggested_fix > web_fix)" },
                  proposed_draft_fix: { type: "string", description: "If no match, a brief proposed fix based on IT knowledge. Use bullet points." },
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

      // If match found, enrich with actual fix data from DB
      if (parsed.match_found && parsed.match_index >= 0 && parsed.match_index < issues.length) {
        const matched = issues[parsed.match_index];
        const bestFix = matched.internal_fix || matched.ai_suggested_fix || matched.web_fix || matched.solution_steps || "";
        parsed.existing_fix = bestFix;
        parsed.match_title = matched.title;
        parsed.match_id = matched.id;
        parsed.match_status = matched.status;
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (mode === "draft") {
      // Generate a fix based on title + description
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
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

      return new Response(JSON.stringify(JSON.parse(toolCall.function.arguments)), {
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

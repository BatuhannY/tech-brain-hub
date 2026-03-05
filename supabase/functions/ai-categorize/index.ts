import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch existing issues for duplicate detection
    const { data: existingIssues } = await supabase
      .from("issue_logs")
      .select("id, title, description, category, report_count")
      .order("created_at", { ascending: false });

    const issuesList = (existingIssues || []).map((i, idx) =>
      `[${idx}] id:${i.id} | Title: ${i.title} | Category: ${i.category} | Description: ${i.description || 'N/A'}`
    ).join("\n");

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
            content: `You are an IT support AI agent. You ONLY provide actionable fixes — never describe the bug back. Your tasks:
1. Assign a category from: Bug, Network, Access, Hardware, Software, Security, Other.
2. Check if any existing issue below is semantically the same problem (duplicate). Return its index or -1.
3. Generate an actionable ai_suggested_fix: step-by-step instructions to resolve this issue.
4. Generate a web_fix: simulate searching the web and provide the best known community solution with specific commands/steps.

Existing issues:
${issuesList || "None yet"}`,
          },
          {
            role: "user",
            content: `New issue:\nTitle: ${title}\nDescription: ${description || 'N/A'}`,
          },
        ],
        tools: [
          {
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
          },
        ],
        tool_choice: { type: "function", function: { name: "categorize_issue" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No AI response received");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const { category, duplicate_index, ai_suggested_fix, web_fix } = parsed;

    // Handle duplicate: increment report_count
    let duplicateId: string | null = null;
    if (duplicate_index >= 0 && existingIssues && duplicate_index < existingIssues.length) {
      const dup = existingIssues[duplicate_index];
      duplicateId = dup.id;
      await supabase
        .from("issue_logs")
        .update({ report_count: (dup.report_count || 1) + 1 })
        .eq("id", dup.id);
    }

    return new Response(JSON.stringify({
      category,
      ai_suggested_fix,
      web_fix,
      duplicate_id: duplicateId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-categorize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

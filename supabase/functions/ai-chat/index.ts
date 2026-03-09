import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Cache & Throttle ---
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 90_000; // 90s
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
    const { messages, addAsIssue } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache key: last user message (skip cache if addAsIssue since it mutates DB)
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const cacheKey = `chat:${lastUserMsg.trim().toLowerCase().slice(0, 200)}`;
    if (!addAsIssue) {
      const cached = getCached(cacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: existingIssues } = await supabase
      .from("issue_logs")
      .select("title, category, status, description, internal_fix, ai_suggested_fix, web_fix, solution_steps, report_count")
      .order("report_count", { ascending: false })
      .limit(50);

    const allIssues = existingIssues || [];
    const resolved = allIssues.filter(i => i.status === "Resolved");
    const unresolved = allIssues.filter(i => i.status !== "Resolved");

    const resolvedContext = resolved.length > 0
      ? resolved.map(i => {
          const fix = i.internal_fix || i.ai_suggested_fix || i.web_fix || i.solution_steps || "No fix recorded";
          return `- [${i.category}/${i.status}] ${i.title} (reported ${i.report_count}x)\n  Fix: ${fix}`;
        }).join("\n")
      : "None yet";

    const unresolvedContext = unresolved.length > 0
      ? unresolved.map(i => {
          const partialFix = i.ai_suggested_fix ? `\n  AI suggestion: ${i.ai_suggested_fix}` : "";
          return `- [${i.category}/${i.status}] ${i.title} (reported ${i.report_count}x)${partialFix}`;
        }).join("\n")
      : "None";

    const systemPrompt = `You are an expert IT support AI agent for a Knowledge Hub. Your role:

CRITICAL PRIORITY RULE: ALWAYS check the RESOLVED FIXES section below FIRST. If a user describes an issue that matches or is similar to a resolved issue, present that verified fix as your PRIMARY answer. Only generate new suggestions if no existing fix applies.

FORMATTING RULES:
- Use bullet points for ALL fix steps (never numbered paragraphs).
- Add blank lines between sections for readability.
- Use clear markdown headings (##) to separate sections.
- When referencing an existing internal fix from the database, wrap it in a blockquote starting with "✅ **Internal Fix (Verified):**" so it stands out.

BEHAVIOR:
1. Check resolved fixes first — reuse proven solutions.
2. Analyze the tech issue and suggest a category (Bug, Network, Access, Hardware, Software, Security, Other).
3. Provide actionable bullet-point fixes — NEVER just describe the bug back.
4. Learn from past issues: reference patterns you see.
5. Suggest ideas to expand the knowledge base.
6. Reference existing issues in the database when relevant.

RESOLVED FIXES (use these first):
${resolvedContext}

UNRESOLVED ISSUES (for reference):
${unresolvedContext}

Be concise, use markdown formatting with generous spacing, and focus on actionable solutions.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const body: any = {
      model: "google/gemini-2.5-flash-lite",
      messages: aiMessages,
    };

    if (addAsIssue) {
      body.tools = [{
        type: "function",
        function: {
          name: "analyze_and_create_issue",
          description: "Analyze the issue, provide a detailed response, and extract structured data for creating a database entry",
          parameters: {
            type: "object",
            properties: {
              reply: { type: "string", description: "Full markdown analysis and fix suggestions for the user" },
              title: { type: "string", description: "Concise issue title" },
              description: { type: "string", description: "Brief issue description" },
              category: { type: "string", enum: ["Bug", "Network", "Access", "Hardware", "Software", "Security", "Other"] },
              ai_suggested_fix: { type: "string", description: "Step-by-step actionable fix" },
              web_fix: { type: "string", description: "Best known community/web solution" },
            },
            required: ["reply", "title", "description", "category", "ai_suggested_fix", "web_fix"],
            additionalProperties: false,
          },
        },
      }];
      body.tool_choice = { type: "function", function: { name: "analyze_and_create_issue" } };
    }

    await throttle();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required, please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    let reply = "";
    let issueCreated = false;

    if (addAsIssue) {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        reply = parsed.reply;

        const { error: insertErr } = await supabase.from("issue_logs").insert({
          title: parsed.title,
          description: parsed.description,
          category: parsed.category,
          ai_suggested_fix: parsed.ai_suggested_fix,
          web_fix: parsed.web_fix,
          status: "Unresolved",
        });
        if (insertErr) {
          console.error("Insert error:", insertErr);
          reply += "\n\n⚠️ Failed to save issue to database.";
        } else {
          issueCreated = true;
          reply += `\n\n✅ **Issue added to database** as "${parsed.title}" under **${parsed.category}**.`;
        }
      }
    } else {
      reply = aiData.choices?.[0]?.message?.content || "No response from AI.";
    }

    const result = { reply, issueCreated };
    if (!addAsIssue) setCache(cacheKey, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

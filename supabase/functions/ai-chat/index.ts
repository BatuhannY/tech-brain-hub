import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, addAsIssue, isAdmin } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch existing issues with full fix data
    const { data: existingIssues } = await supabase
      .from("issue_logs")
      .select("title, category, status, description, internal_fix, ai_suggested_fix, web_fix, solution_steps, report_count, created_at, updated_at")
      .order("report_count", { ascending: false })
      .limit(50);

    const allIssues = existingIssues || [];
    const resolved = allIssues.filter(i => i.status === "Resolved");
    const unresolved = allIssues.filter(i => i.status !== "Resolved");

    // Build context based on role
    let systemPrompt: string;

    if (isAdmin) {
      // --- ADMIN SYSTEM PROMPT ---
      const resolvedContext = resolved.length > 0
        ? resolved.map(i => {
            const fix = i.internal_fix || i.ai_suggested_fix || i.web_fix || i.solution_steps || "No fix recorded";
            return `- [${i.category}/${i.status}] "${i.title}" (reported ${i.report_count}x, last updated ${i.updated_at})\n  Description: ${i.description || "N/A"}\n  Internal Fix: ${i.internal_fix || "None"}\n  AI Fix: ${i.ai_suggested_fix || "None"}\n  Web Fix: ${i.web_fix || "None"}\n  Solution Steps: ${i.solution_steps || "None"}`;
          }).join("\n")
        : "None yet";

      const unresolvedContext = unresolved.length > 0
        ? unresolved.map(i => {
            return `- [${i.category}/${i.status}] "${i.title}" (reported ${i.report_count}x, created ${i.created_at})\n  Description: ${i.description || "N/A"}\n  Internal Fix: ${i.internal_fix || "None"}\n  AI Suggestion: ${i.ai_suggested_fix || "None"}`;
          }).join("\n")
        : "None";

      // Analytics summary
      const totalIssues = allIssues.length;
      const unresolvedCount = unresolved.length;
      const resolvedCount = resolved.length;
      const categories: Record<string, number> = {};
      allIssues.forEach(i => { categories[i.category] = (categories[i.category] || 0) + 1; });
      const categoryBreakdown = Object.entries(categories).map(([k, v]) => `${k}: ${v}`).join(", ");

      systemPrompt = `You are an expert IT support AI agent operating in ADMIN MODE for a Knowledge Hub. You have elevated access and provide detailed, technical responses with full internal data.

## YOUR CAPABILITIES:
1. **Deep Analytics**: You have access to full issue data including internal fixes, report counts, timestamps, and resolution stats.
2. **Issue Management**: You can update issue statuses, mark issues as resolved, and manage the knowledge base. When an admin asks to resolve/update an issue, use the update_issue_status tool.
3. **Analytics Summaries**: When asked for analytics or "what needs attention", use the get_analytics_summary tool.
4. **Proactive Fix Recommendations**: For unknown/unresolved issues with no existing fix, proactively generate detailed investigation plans with:
   - Potential root causes ranked by likelihood
   - Step-by-step diagnostic procedures
   - Recommended fixes to try
   - Escalation paths if fixes don't work
5. **Pattern Analysis**: Identify recurring issue patterns and suggest knowledge base improvements.

## CURRENT DATABASE STATS:
- Total issues: ${totalIssues} | Resolved: ${resolvedCount} | Unresolved: ${unresolvedCount}
- Categories: ${categoryBreakdown}

## FORMATTING RULES:
- Use bullet points for ALL fix steps (never numbered paragraphs).
- Add blank lines between sections for readability.
- Use clear markdown headings (##) to separate sections.
- When referencing an internal fix, wrap it in a blockquote starting with "✅ **Internal Fix (Verified):**"
- Show report counts and timestamps when relevant.
- Use technical language appropriate for IT admins.

## BEHAVIOR:
1. Check resolved fixes first — reuse proven solutions with full internal detail.
2. For unresolved issues without fixes, generate a **Recommended Investigation Plan** with root causes and diagnostic steps.
3. Show pattern analysis: e.g., "This is the 3rd VPN issue this week — consider creating a VPN troubleshooting runbook."
4. When asked to manage issues (resolve, update status, etc.), use the appropriate tool.
5. When asked for analytics or summaries, use the get_analytics_summary tool.
6. Always include internal metrics (report count, resolution rate, time since creation) when discussing issues.

## RESOLVED ISSUES (full detail):
${resolvedContext}

## UNRESOLVED ISSUES (full detail):
${unresolvedContext}`;

    } else {
      // --- PUBLIC SYSTEM PROMPT ---
      const resolvedContext = resolved.length > 0
        ? resolved.map(i => {
            const fix = i.ai_suggested_fix || i.web_fix || i.solution_steps || "No fix recorded";
            return `- [${i.category}] ${i.title}\n  Fix: ${fix}`;
          }).join("\n")
        : "None yet";

      const unresolvedContext = unresolved.length > 0
        ? unresolved.map(i => `- [${i.category}] ${i.title}`).join("\n")
        : "None";

      systemPrompt = `You are a friendly IT support assistant for a Knowledge Hub. Your goal is to help users resolve their tech issues quickly and clearly.

## FORMATTING RULES:
- Use bullet points for ALL fix steps.
- Add blank lines between sections.
- Use clear markdown headings (##).
- Keep language simple and user-friendly — avoid internal jargon.
- Focus on actionable "here's how to fix it" steps.

## BEHAVIOR:
1. Check known fixes first and present them as your primary answer.
2. Provide clear, step-by-step troubleshooting guidance.
3. Suggest a category for the issue (Bug, Network, Access, Hardware, Software, Security, Other).
4. If an issue is known but unresolved, let the user know it's being tracked.
5. Be encouraging and supportive.

## KNOWN FIXES:
${resolvedContext}

## KNOWN ISSUES (being tracked):
${unresolvedContext}

Be concise, use markdown formatting, and focus on helping the user fix their problem.`;
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: aiMessages,
    };

    // Admin-only tools
    if (isAdmin && !addAsIssue) {
      body.tools = [
        {
          type: "function",
          function: {
            name: "update_issue_status",
            description: "Update the status of an existing issue by matching its title. Use when admin asks to resolve, close, or change status of an issue.",
            parameters: {
              type: "object",
              properties: {
                title_search: { type: "string", description: "The issue title or partial match to search for" },
                new_status: { type: "string", enum: ["Resolved", "Unresolved", "In Progress", "Known Issue"], description: "The new status to set" },
              },
              required: ["title_search", "new_status"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_analytics_summary",
            description: "Get a detailed analytics summary of all issues including category breakdown, resolution rates, and trending patterns. Use when admin asks for analytics, summary, or what needs attention.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
            },
          },
        },
      ];
    }

    // Add-as-issue tool (admin only in UI, but handle server-side too)
    if (addAsIssue) {
      body.tools = [
        {
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
        },
      ];
      body.tool_choice = { type: "function", function: { name: "analyze_and_create_issue" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
    let reply = "";
    let issueCreated = false;
    let commandExecuted = false;

    // Handle tool calls
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls || [];

    if (addAsIssue && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      if (toolCall?.function?.name === "analyze_and_create_issue") {
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
    } else if (isAdmin && toolCalls.length > 0) {
      // Process admin tool calls
      const toolResults: string[] = [];

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || "{}");

        if (fnName === "update_issue_status") {
          const { data: matchedIssues } = await supabase
            .from("issue_logs")
            .select("id, title, status")
            .ilike("title", `%${args.title_search}%`)
            .limit(5);

          if (matchedIssues && matchedIssues.length > 0) {
            const issue = matchedIssues[0];
            const { error: updateErr } = await supabase
              .from("issue_logs")
              .update({ status: args.new_status })
              .eq("id", issue.id);

            if (updateErr) {
              toolResults.push(`❌ Failed to update "${issue.title}": ${updateErr.message}`);
            } else {
              toolResults.push(`✅ Updated "${issue.title}" from **${issue.status}** → **${args.new_status}**`);
              commandExecuted = true;
            }
          } else {
            toolResults.push(`⚠️ No issue found matching "${args.title_search}"`);
          }
        } else if (fnName === "get_analytics_summary") {
          const { data: allData } = await supabase
            .from("issue_logs")
            .select("title, category, status, report_count, created_at, updated_at");

          const issues = allData || [];
          const total = issues.length;
          const unresolvedN = issues.filter(i => i.status !== "Resolved").length;
          const resolvedN = issues.filter(i => i.status === "Resolved").length;
          const cats: Record<string, number> = {};
          const statusCounts: Record<string, number> = {};
          issues.forEach(i => {
            cats[i.category] = (cats[i.category] || 0) + 1;
            statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
          });
          const topReported = [...issues].sort((a, b) => b.report_count - a.report_count).slice(0, 5);

          toolResults.push(`## 📊 Analytics Summary\n\n- **Total issues**: ${total}\n- **Resolved**: ${resolvedN} | **Unresolved**: ${unresolvedN}\n- **Resolution rate**: ${total > 0 ? Math.round((resolvedN / total) * 100) : 0}%\n\n**By Category**: ${Object.entries(cats).map(([k, v]) => `${k} (${v})`).join(", ")}\n\n**By Status**: ${Object.entries(statusCounts).map(([k, v]) => `${k} (${v})`).join(", ")}\n\n**Most Reported**:\n${topReported.map(i => `- "${i.title}" — ${i.report_count}x (${i.status})`).join("\n")}`);
        }
      }

      // Send tool results back to AI for a natural language response
      const followUp = [
        ...aiMessages,
        aiData.choices[0].message,
        ...toolCalls.map((tc: any, idx: number) => ({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResults[idx] || "Done",
        })),
      ];

      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: followUp }),
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        reply = followUpData.choices?.[0]?.message?.content || toolResults.join("\n\n");
      } else {
        reply = toolResults.join("\n\n");
      }
    } else {
      reply = aiData.choices?.[0]?.message?.content || "No response from AI.";
    }

    return new Response(JSON.stringify({ reply, issueCreated, commandExecuted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

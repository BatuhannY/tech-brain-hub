// v3 - public access fix: verify_jwt=false redeployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { mode, issues, issueTitle, issueDescription, chatTranscript } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "knowledge-health") {
      systemPrompt = `You are a Knowledge Base Health Analyst. Analyze the provided issue logs and identify content gaps.
Return a JSON object using this exact tool call schema.`;
      userPrompt = `Analyze these ${issues.length} issue logs and identify content gaps where many issues exist but few detailed fixes are available.

Issue data:
${JSON.stringify(issues.map((i: any) => ({ title: i.title, category: i.category, status: i.status, has_fix: !!(i.internal_fix || i.ai_suggested_fix) })), null, 2)}

Identify gaps and suggest 3 proactive guides to write.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "report_knowledge_health",
            description: "Report knowledge base health analysis with content gaps and suggested guides.",
            parameters: {
              type: "object",
              properties: {
                overall_health_score: { type: "number", description: "Score 0-100" },
                total_issues: { type: "number" },
                issues_with_fixes: { type: "number" },
                content_gaps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      issue_count: { type: "number" },
                      fix_count: { type: "number" },
                      gap_severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      description: { type: "string" }
                    },
                    required: ["category", "issue_count", "fix_count", "gap_severity", "description"],
                    additionalProperties: false
                  }
                },
                suggested_guides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      category: { type: "string" },
                      rationale: { type: "string" },
                      outline: { type: "array", items: { type: "string" } }
                    },
                    required: ["title", "category", "rationale", "outline"],
                    additionalProperties: false
                  }
                }
              },
              required: ["overall_health_score", "total_issues", "issues_with_fixes", "content_gaps", "suggested_guides"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "report_knowledge_health" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "root-cause") {
      systemPrompt = `You are a Root Cause Analyst. Analyze issue descriptions to find the single most significant underlying root cause pattern.`;
      userPrompt = `Analyze these ${issues.length} recent issue descriptions and find the #1 underlying root cause pattern:

${issues.map((i: any) => `- [${i.category}] ${i.title}: ${i.description || 'No description'}`).join('\n')}

Identify the master root cause — not individual symptoms but the systemic pattern.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "report_root_cause",
            description: "Report the master root cause insight.",
            parameters: {
              type: "object",
              properties: {
                root_cause_title: { type: "string" },
                root_cause_description: { type: "string" },
                confidence: { type: "number", description: "0-100" },
                affected_categories: { type: "array", items: { type: "string" } },
                affected_issue_count: { type: "number" },
                recommended_actions: { type: "array", items: { type: "string" } },
                supporting_evidence: { type: "array", items: { type: "string" } }
              },
              required: ["root_cause_title", "root_cause_description", "confidence", "affected_categories", "affected_issue_count", "recommended_actions", "supporting_evidence"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "report_root_cause" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "related-issues") {
      systemPrompt = `You are a semantic issue analyst. Find issues that are semantically related to the given issue — not just keyword matches but conceptually connected problems.`;
      userPrompt = `Given this issue:
Title: "${issueTitle}"
Description: "${issueDescription || 'N/A'}"

Find the most semantically related issues from this list. Return their indices (0-based) and explain the connection:

${issues.map((i: any, idx: number) => `[${idx}] [${i.category}] ${i.title}: ${i.description || 'N/A'}`).join('\n')}`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "report_related_issues",
            description: "Report semantically related issues.",
            parameters: {
              type: "object",
              properties: {
                related: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      relevance: { type: "string", enum: ["high", "medium", "low"] },
                      connection: { type: "string" }
                    },
                    required: ["index", "relevance", "connection"],
                    additionalProperties: false
                  }
                }
              },
              required: ["related"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "report_related_issues" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "parse-chat") {
      systemPrompt = `You are a support chat parser. Extract structured issue data from messy chat transcripts. IMPORTANT: Remove all personal names, usernames, handles, and identifying information from the output. Replace any names with generic terms like "the user", "the reporter", "a team member", etc.`;
      userPrompt = `Parse this chat transcript and extract structured issue data. Strip out ALL personal names, usernames, and identifying info — anonymize everything:

${chatTranscript}

Extract the title, description, and any proposed fix steps mentioned.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "parse_chat_transcript",
            description: "Extract structured issue data from a chat transcript.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                proposed_fix: { type: "string" },
                suggested_category: { type: "string", enum: ["Bug", "Network", "Access", "Hardware", "Software", "Security", "Other"] },
                confidence: { type: "number", description: "0-100 confidence in extraction quality" }
              },
              required: ["title", "description", "proposed_fix", "suggested_category", "confidence"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "parse_chat_transcript" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "generate-playbook") {
      systemPrompt = `You are a professional IT documentation writer. Transform raw technical fixes into clean, user-friendly playbook entries. 
Use professional but simplified language suitable for non-technical users. Each entry must have:
1. A clear issue summary (1-2 sentences)
2. Step-by-step fix instructions (3-7 clear steps)
3. A prevention tip (1 sentence)`;

      userPrompt = `Transform these ${issues.length} validated issue fixes into clean playbook entries:

${issues.map((i: any) => `---
ID: ${i.id}
Title: ${i.title}
Category: ${i.category}
Description: ${i.description || 'N/A'}
Internal Fix: ${i.internal_fix}
---`).join('\n')}

Generate a structured playbook entry for each issue.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "generate_playbook_entries",
            description: "Generate structured playbook entries from validated fixes.",
            parameters: {
              type: "object",
              properties: {
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "The original issue ID" },
                      title: { type: "string", description: "Clean, user-friendly title" },
                      category: { type: "string" },
                      summary: { type: "string", description: "1-2 sentence issue summary for non-tech users" },
                      steps: { type: "array", items: { type: "string" }, description: "3-7 clear step-by-step fix instructions" },
                      prevention: { type: "string", description: "1 sentence prevention tip" }
                    },
                    required: ["id", "title", "category", "summary", "steps", "prevention"],
                    additionalProperties: false
                  }
                }
              },
              required: ["entries"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "generate_playbook_entries" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "daily-summary") {
      systemPrompt = `You are an executive IT briefing analyst. Analyze all issue activity from the last 24 hours and generate a concise daily summary with exactly 3 bullet points. Be specific with numbers and issue titles.`;
      userPrompt = `Analyze these ${issues.length} issues and generate a daily executive briefing. Focus on activity from the last 24 hours:

${JSON.stringify(issues, null, 2)}

Generate: Key Wins (resolved/validated), Emerging Trends (new patterns), and Recommended Focus for Tomorrow.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "daily_summary",
            description: "Generate daily executive briefing.",
            parameters: {
              type: "object",
              properties: {
                key_wins: { type: "string", description: "1-2 sentence summary of key wins/resolutions in the last 24h" },
                emerging_trends: { type: "string", description: "1-2 sentence summary of emerging issue trends" },
                recommended_focus: { type: "string", description: "1-2 sentence actionable recommendation for tomorrow" }
              },
              required: ["key_wins", "emerging_trends", "recommended_focus"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "daily_summary" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "generate-faq") {
      systemPrompt = `You are a customer-facing FAQ writer. Identify the top 5 most frequent or highest-impact validated solutions from issue data and present them as clear Q&A pairs. Questions should be natural, the way a user would ask. Answers should be helpful, concise, and reference the fix.`;
      userPrompt = `From these ${issues.length} issues, identify the 5 most impactful/frequent validated solutions and write FAQ entries:

${JSON.stringify(issues, null, 2)}

Write natural questions a user would ask and clear answers based on the validated fixes.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "generate_faq",
            description: "Generate top 5 FAQ entries.",
            parameters: {
              type: "object",
              properties: {
                faqs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string", description: "Natural user question" },
                      answer: { type: "string", description: "Clear, helpful answer with fix details" }
                    },
                    required: ["question", "answer"],
                    additionalProperties: false
                  }
                }
              },
              required: ["faqs"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "generate_faq" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "draft-announcement") {
      const issue = issues[0];
      systemPrompt = `You are a friendly internal communications writer. Draft a professional, modern Slack/Teams-ready team update message about a resolved issue. Use emojis for a modern "Company News" feel. Include: a brief summary of the fix, reference to the playbook, and a 1-sentence pro-tip to prevent the issue in the future. Keep it under 200 words. Do NOT use markdown formatting - use plain text with emojis.`;
      userPrompt = `Draft a team update announcement for this resolved issue:

Title: ${issue.title}
Category: ${issue.category}
Description: ${issue.description || 'N/A'}
Fix: ${issue.internal_fix || issue.ai_suggested_fix || 'N/A'}

Write a friendly, emoji-rich team announcement.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "draft_announcement",
            description: "Draft a team update announcement.",
            parameters: {
              type: "object",
              properties: {
                announcement: { type: "string", description: "The full announcement text with emojis" }
              },
              required: ["announcement"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "draft_announcement" } });

      return jsonResponse(response, corsHeaders);
    }

    if (mode === "status-report") {
      systemPrompt = `You are a concise IT status reporter. Generate a single, punchy sentence summarizing the current system health based on issue data. Include specific metrics when available. Be direct and actionable.`;
      userPrompt = `Based on these ${issues.length} recent issues, generate a one-sentence status report:

Categories: ${JSON.stringify([...new Set(issues.map((i: any) => i.category))])}
Status breakdown: ${JSON.stringify(issues.reduce((acc: any, i: any) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {}))}
Recent issues: ${issues.slice(0, 10).map((i: any) => `[${i.category}] ${i.title}`).join(', ')}

Generate a single professional status sentence.`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, [
        {
          type: "function",
          function: {
            name: "report_status",
            description: "Generate a one-sentence system status report.",
            parameters: {
              type: "object",
              properties: {
                report: { type: "string", description: "A single sentence status report" }
              },
              required: ["report"],
              additionalProperties: false
            }
          }
        }
      ], { type: "function", function: { name: "report_status" } });

      return jsonResponse(response, corsHeaders);
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-analytics error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(apiKey: string, system: string, user: string, tools: any[], toolChoice: any) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools,
      tool_choice: toolChoice,
    }),
  });

  if (!res.ok) {
    if (res.status === 429) return { error: "Rate limit exceeded. Please try again later." };
    if (res.status === 402) return { error: "Payment required. Please add AI credits." };
    const t = await res.text();
    console.error("AI gateway error:", res.status, t);
    return { error: "AI gateway error" };
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      return { error: "Failed to parse AI response" };
    }
  }
  return { error: "No tool call in AI response" };
}

function jsonResponse(data: any, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

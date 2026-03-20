import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Verify Slack request signature
async function verifySlackSignature(req: Request, body: string): Promise<boolean> {
  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (!signingSecret) {
    console.warn("SLACK_SIGNING_SECRET not set — skipping verification");
    return true; // Allow in dev/demo mode
  }

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSignature = req.headers.get("x-slack-signature");

  if (!timestamp || !slackSignature) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigBasestring));
  const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  const computed = `v0=${hex}`;

  return computed === slackSignature;
}

// Simple keyword similarity search against issue_logs
function scoreIssue(issue: any, query: string): number {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const text = `${issue.title} ${issue.description || ""} ${issue.category} ${issue.internal_fix || ""} ${issue.solution_steps || ""} ${issue.ai_suggested_fix || ""}`.toLowerCase();

  let score = 0;
  words.forEach(w => { if (text.includes(w)) score += 1; });
  if (issue.title.toLowerCase().includes(lower)) score += 3;
  if (issue.status === "Resolved") score += 1;
  return score;
}

// Strip HTML tags for clean text
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// Format response as Slack Block Kit message
function formatSlackResponse(issues: any[], query: string) {
  if (issues.length === 0) {
    return {
      response_type: "ephemeral",
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `🔍 No matching results found for *"${query}"*.\nTry different keywords or contact your support team.` },
        },
      ],
    };
  }

  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `🤖 *Knowledge Hub Bot* found *${issues.length}* result(s) for _"${query}"_:` },
    },
    { type: "divider" },
  ];

  issues.forEach((issue, i) => {
    const statusEmoji = issue.status === "Resolved" ? "✅" : "🔶";
    const fix = stripHtml(issue.internal_fix || "") || issue.solution_steps || issue.ai_suggested_fix || "_No fix documented yet_";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${i + 1}. ${issue.title}*\n${statusEmoji} ${issue.status} · ${issue.category}${issue.report_count > 1 ? ` · ${issue.report_count} reports` : ""}\n\n*Fix:* ${fix}`,
      },
    });
    if (i < issues.length - 1) blocks.push({ type: "divider" });
  });

  return { response_type: "in_channel", blocks };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();

    // Verify Slack signature
    const isValid = await verifySlackSignature(req, body);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(body);

    // Handle Slack URL verification challenge
    if (payload.type === "url_verification") {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract query text from slash command or event
    const query = payload.text || payload.event?.text || "";
    if (!query) {
      return new Response(JSON.stringify(formatSlackResponse([], "")), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search issues in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: issues, error } = await supabase
      .from("issue_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Score and rank issues by relevance
    const ranked = (issues || [])
      .map(issue => ({ issue, score: scoreIssue(issue, query) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.issue);

    const slackResponse = formatSlackResponse(ranked, query);

    return new Response(JSON.stringify(slackResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("slack-webhook error:", e);
    return new Response(
      JSON.stringify({ response_type: "ephemeral", text: "⚠️ Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

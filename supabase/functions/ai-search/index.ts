import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Cache & Throttle ---
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000; // 60s
let lastCallTs = 0;
const MIN_INTERVAL = 2_000; // 2s between AI calls

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
  // Evict old entries
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
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
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `search:${query.trim().toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: issues, error: dbError } = await supabase
      .from("issue_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) throw dbError;
    if (!issues || issues.length === 0) {
      const result = { results: [] };
      setCache(cacheKey, result);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const issuesSummary = issues.map((i, idx) =>
      `[${idx}] Title: ${i.title} | Category: ${i.category} | Status: ${i.status} | Description: ${i.description || 'N/A'}`
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
            content: `You are a semantic search engine for tech support issues. Given a user query and a list of issues, return the indices of the most relevant issues sorted by relevance. Only return issues that are semantically related to the query. Return a JSON array of indices, e.g. [2, 0, 5]. If nothing is relevant, return [].`,
          },
          { role: "user", content: `Query: "${query}"\n\nIssues:\n${issuesSummary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "rank_issues",
            description: "Return ranked indices of relevant issues",
            parameters: {
              type: "object",
              properties: {
                indices: { type: "array", items: { type: "number" }, description: "Array of issue indices sorted by relevance" },
              },
              required: ["indices"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rank_issues" } },
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
    let indices: number[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        indices = parsed.indices || [];
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    const results = indices
      .filter((i) => i >= 0 && i < issues.length)
      .map((i) => issues[i]);

    const result = { results };
    setCache(cacheKey, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

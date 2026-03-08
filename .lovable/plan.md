

## Plan: Role-Aware AI Agent (Admin vs Public)

### Overview
Make the AI Agent behave differently based on whether the user is an admin or a regular public user. Admin gets deeper data, management commands, technical detail, and proactive fix recommendations for unknown issues. Public users get simplified, user-friendly answers.

### Changes

**1. Frontend: Pass `isAdmin` flag to the edge function**

- **`src/components/AIChat.tsx`** — Accept an `isAdmin` prop, send it in the request body. When `isAdmin`:
  - Show the "Add as issue" checkbox (currently always visible — hide for public users)
  - Add admin-only quick commands as hint chips: "Resolve issue...", "Show analytics summary", "What needs attention?"
  - Show a subtle "Admin Mode" badge next to the bot icon
  - Change placeholder text to "Ask about issues, run commands, or get analytics..."

- **`src/components/Dashboard.tsx`** — Pass `isAdmin={true}` to `<AIChat />`
- **`src/pages/PublicPlaybook.tsx`** — Pass `isAdmin={false}` to `<AIChat />`

**2. Backend: Two different system prompts + admin commands**

- **`supabase/functions/ai-chat/index.ts`** — Read the new `isAdmin` boolean from the request body and branch behavior:

  **Admin system prompt additions:**
  - Include internal fix notes, report counts, full issue descriptions, resolution stats
  - Enable management commands: "resolve issue X", "mark as duplicate", "update status to..."
  - Use technical/detailed tone with internal metrics
  - When an issue has no known fix, proactively research and recommend potential solutions with step-by-step investigation approaches
  - Show pattern analysis: "3 VPN issues this week — consider a VPN troubleshooting guide"

  **Public system prompt differences:**
  - Simplified, friendly language — no internal metrics or report counts
  - No management commands
  - Hide internal fix details — just show the actionable steps
  - Focus on "here's how to fix it" without admin context

  **Admin command tools** (tool calling for structured actions):
  - `update_issue_status` — change status of an issue by title match
  - `get_analytics_summary` — return category breakdown, unresolved count, trending patterns
  - When the AI detects an unknown issue with no existing fix, it generates a detailed investigation plan with potential root causes and recommended diagnostic steps

**3. Admin command execution in edge function**

When `isAdmin` is true, add additional tools to the AI call:
- `update_issue_status`: params `{title, new_status}` — fuzzy-match issue title, update status via service role
- `get_analytics_summary`: no params — query issue_logs for counts by category/status and return structured data
- `recommend_fix`: for unknown issues — AI generates a detailed investigation/fix recommendation

The edge function executes these tool calls server-side using the service role key, then returns results to the AI for a natural language response.

### Files to Change
- `src/components/AIChat.tsx` — add `isAdmin` prop, conditional UI
- `src/components/Dashboard.tsx` — pass `isAdmin={true}`
- `src/pages/PublicPlaybook.tsx` — pass `isAdmin={false}`
- `supabase/functions/ai-chat/index.ts` — dual system prompts, admin tool calls, command execution

### No database changes needed
All admin verification happens via the `isAdmin` prop from the authenticated frontend. The edge function uses the service role key for admin operations, so no new RLS policies are needed.


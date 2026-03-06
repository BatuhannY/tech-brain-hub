## Problem

The `ai-chat` edge function has two issues causing it to ignore existing resolved fixes:

1. **Incomplete data fetch**: The query only selects `title, category, status, description` — omitting `internal_fix`, `ai_suggested_fix`, `web_fix`, and `solution_steps`.
2. **No prioritization logic**: Resolved/Validated issues aren't prioritized in the context, and the system prompt doesn't instruct the AI to prefer them.  
3. Make the AI Agent tab more visually pleasing and simple to use. Also make sure when switching tabs, the AI Agent conversation stays so it does not "reset" everytime we switch tabs.

## Plan

### 1. Update the database query in `ai-chat/index.ts`

- Add `internal_fix`, `ai_suggested_fix`, `web_fix`, `solution_steps` to the select.
- Order by status (Validated first, then Resolved) and then by `report_count` descending.
- Separate resolved issues from unresolved in the context string, clearly marking which have verified fixes.

### 2. Update the system prompt

- Add a clear instruction: "ALWAYS check resolved/validated issues first. If a matching fix exists in the database, present it as the primary answer before generating new suggestions."
- Format resolved issues with their fix content so the AI can directly reference them.

### 3. Improve context formatting

Instead of just listing titles, format resolved issues like:

```
RESOLVED FIXES (use these first):
- [Network/Validated] VPN not connecting
  Fix: <internal_fix content>

UNRESOLVED ISSUES (for reference):
- [Bug/Unresolved] Outlook crashes
```

This ensures the AI has the actual fix content and clear instructions to prioritize it.
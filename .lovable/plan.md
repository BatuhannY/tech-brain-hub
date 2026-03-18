

## Plan: Local Parsing Fallback + Fix HTML Stripping in AI Chat

### Two changes needed:

---

### 1. QuickImport: Add local (database-mode) parsing fallback

When AI is offline, the "Parse Transcript" button currently calls the `ai-analytics` edge function which will fail with 402. Instead, add a simple keyword-based local parser that extracts a title, description, and category from the transcript text without AI.

**Changes to `src/components/QuickImport.tsx`:**
- Import `useAIStatus` hook
- Add a `parseLocally(transcript)` function that:
  - Takes the first sentence as the title
  - Uses the full text as description
  - Matches keywords against known categories (e.g., "login" → "Authentication", "network"/"VPN" → "Network", "email"/"outlook" → "Email", etc.) with a fallback of "General"
  - Sets confidence to a lower value (e.g., 60%) to indicate it's rule-based
  - Returns the same `ParsedData` shape
- In `handleParse`, check `isAIOffline` — if true, use `parseLocally()` instead of calling the edge function
- Update the button label to show "Parse (Database Mode)" when offline

---

### 2. AI Chat: Strip HTML from internal_fix before displaying

The `getDBResponse` function in `AIChat.tsx` reads `issue.internal_fix` which contains Tiptap HTML (e.g., `<p>`, `<ol>`, `<li>` tags). It's inserted raw into the markdown response string, causing `> <p>Step 1</p>` to render with visible tags.

**Changes to `src/components/AIChat.tsx`:**
- Add a `stripHtml()` helper (using `DOMParser` to extract text content, same pattern as PlaybookView)
- In the `getDBResponse` function at line 51-53, run `stripHtml()` on `internal_fix` and `solution_steps` before inserting into the markdown response string

---

### Technical details

**Local parser logic (QuickImport):**
```text
Input: "Hey, user X can't log in, they keep getting a 500 error..."
Output: {
  title: "Hey, user X can't log in, they keep getting a 500 error",
  description: <full transcript>,
  suggested_category: "Authentication",  // matched "log in"
  proposed_fix: "",
  confidence: 60
}
```

**HTML stripping (AIChat):**
```typescript
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
// Applied to internal_fix before inserting into markdown response
```

Both changes are purely client-side with no database or edge function modifications needed.


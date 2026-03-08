

## Plan: Auto-Duplicate Detection, CSV/PDF Export, and Clickability Fixes

### 1. Auto-Duplicate Detection on Issue Creation

**What:** When a user types a title in the new issue form, show a warning banner if a semantically similar issue already exists (before saving).

**How:**
- The copilot already does this partially via `ai-copilot` edge function (returns `match_found`, `match_title`, etc.)
- Enhance the existing copilot banner in `IssueFormDialog.tsx` to show a clearer "Duplicate detected" warning with a link to expand the matched issue
- On save, the `ai-categorize` function already increments `report_count` for duplicates -- add a confirmation dialog asking "A similar issue exists. Still create a new one?" before proceeding

**Files:** `src/components/IssueFormDialog.tsx`

---

### 2. CSV / PDF Export

**What:** Add export buttons to the Dashboard header or issues list to download all issues (or filtered issues) as CSV or PDF.

**How:**
- **CSV:** Build in-browser using plain JS -- iterate over issues array, generate comma-separated string, trigger download via `Blob` + `URL.createObjectURL`. No library needed.
- **PDF:** Use the browser's `window.print()` with a print-optimized view, or generate a simple PDF using a lightweight approach (format issues as HTML, open in a new window, call `print()`). This avoids adding a heavy PDF library.
- Add a dropdown menu with "Export CSV" and "Export PDF" options next to the "New Issue" button in the Dashboard header.

**Files:** `src/components/Dashboard.tsx`, new `src/lib/export-utils.ts`

---

### 3. Fix: Related Intelligence Items Not Clickable

**What:** Clicking a related issue in the sidebar should expand that issue in the main list.

**How:**
- Pass an `onIssueSelect` callback from `Dashboard` -> `IssueDetail` -> `RelatedIntelligence`
- When a related item is clicked, call `onIssueSelect(issueId)` which sets `expandedId` in Dashboard to scroll to and expand that issue
- Wrap each related item card in a clickable div with hover styles and cursor-pointer

**Files:** `src/components/RelatedIntelligence.tsx`, `src/components/IssueDetail.tsx`, `src/components/Dashboard.tsx`

---

### 4. Fix: Suggested Proactive Guides Outline Not Clickable

**What:** The outline items in `KnowledgeHealth.tsx` are plain `<li>` text elements with no interactivity.

**How:**
- These outline items are AI-generated text strings (e.g., "Step 1: Check DNS settings"), not links. They aren't meant to navigate anywhere -- they're guide outlines.
- Make them actionable by adding a "Create as Issue" button on each guide card that pre-fills the issue form with the guide's title and outline as description.
- Alternatively, add a "Copy outline" button to copy the guide as markdown.

**Files:** `src/components/KnowledgeHealth.tsx`

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/IssueFormDialog.tsx` | Add duplicate confirmation dialog before save |
| `src/lib/export-utils.ts` | New file: CSV generation + PDF print utilities |
| `src/components/Dashboard.tsx` | Add export dropdown (CSV/PDF), pass `onIssueSelect` through components |
| `src/components/RelatedIntelligence.tsx` | Make items clickable, accept `onIssueSelect` prop |
| `src/components/IssueDetail.tsx` | Pass `onIssueSelect` to RelatedIntelligence |
| `src/components/KnowledgeHealth.tsx` | Add "Create as Issue" / "Copy outline" buttons on guide cards |


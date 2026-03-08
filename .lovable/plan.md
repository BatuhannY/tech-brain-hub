

## The Problem

Playbook is just a filtered subset of Issues with a copy button. It doesn't feel like a distinct, valuable tab. Two options:

### Option A: Merge Playbook into Issues
Remove the Playbook tab entirely. Add a small "KB Proposed" filter toggle on the Issues tab, and add a "Copy as Markdown" action to each issue's action buttons (pencil/trash row). Add a "Export All KB" button in the header when the filter is active. This reduces tab clutter from 5 to 4.

### Option B: Differentiate Playbook as a proper "Knowledge Base"
Redesign Playbook to feel like a polished documentation viewer rather than a card list. Group entries by category with collapsible sections, show a richer preview with formatted fixes, and add a "Download .md" export. Make it feel like reading a wiki, not a task list.

### Recommendation: Option A (Merge)

It's cleaner, reduces cognitive load, and the export functionality doesn't justify its own tab. Here's what changes:

**Dashboard.tsx**
- Remove "Playbook" tab trigger
- Add a toggle/filter chip "KB Proposed" on the Issues tab toolbar (next to search)
- When active, filter `displayIssues` to only `kb_proposed === true` and show a "Copy All as Markdown" button
- Add a small copy icon button to each issue row (next to edit/delete)

**PlaybookProposals.tsx**
- Keep the `formatForExport` utility but move it to a shared util or inline it
- Component can be deleted

**No backend changes needed.**


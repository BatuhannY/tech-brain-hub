

## Plan: Known Issues Status Banner in Playbook Tab

### What We're Building

A collapsible "Current Known Issues" section at the top of the Playbook view — before the FAQ and search. It shows **unresolved** issues grouped by category with their status, so agents can quickly see what's actively broken without leaving the Playbook tab.

### Design

```text
┌─────────────────────────────────────────────┐
│ ⚠ 4 Active Known Issues            [Hide ▲]│
├─────────────────────────────────────────────┤
│  🔴 Bug (2)                                 │
│    • Login fails on Safari — Investigating  │
│    • Payment timeout on large orders         │
│  🟡 Feature Request (1)                     │
│    • Dark mode toggle missing                │
│  🔵 Account (1)                             │
│    • Password reset emails delayed           │
└─────────────────────────────────────────────┘
── Dynamic FAQ ──────────────────────────────
── Search ───────────────────────────────────
── Resolved Playbook Entries ────────────────
```

### Implementation

1. **New component `KnownIssuesBanner.tsx`**
   - Query `issue_logs` where `status = 'Unresolved'` (or `status != 'Resolved'`)
   - Group by `category`, show title and report count
   - Collapsible with local state, default expanded
   - Realtime subscription so it updates live
   - Minimal styling: a single card with amber/warning accent, no heavy visuals

2. **Update `PlaybookView.tsx`**
   - Import and render `<KnownIssuesBanner />` at the top of the view (before `<DynamicFAQ>`)
   - Only renders if there are unresolved issues; invisible otherwise

No new tabs, no new routes, no database changes needed — reads existing `issue_logs` data.


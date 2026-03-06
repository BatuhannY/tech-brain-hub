## Problem

When the AI Agent creates a new issue via the "Add as a new issue" checkbox, the issue is successfully inserted into the database, but the "All Issues" tab doesn't show it because the React Query cache (`['issue_logs']`) is never invalidated after the AI chat creates a record.

The `AIChat` component operates independently and has no way to signal `Dashboard` to refetch.

## Plan

### 1. Pass a refetch callback to AIChat

In `Dashboard.tsx`, pass the `refetch` function as a prop to `<AIChat />`:

```
<AIChat onIssueCreated={refetch} />
```

### 2. Update AIChat to call the callback

In `AIChat.tsx`, accept an `onIssueCreated` prop. After the AI confirms `data.issueCreated === true`, call `onIssueCreated()` to invalidate the issues list cache.  
  
3. When entering the fixes via AI agent, make sure the AI adds them as bulletpoints so it is easier to view.  
  
[4.AI](http://4.AI) agent should continiously learn from the issues for future references.  
  
[5.AI](http://5.AI) Agent should use more spacing in its answers. At the moment, its a bit cramped and when fetching internal fixes, the internal fixes should have a box highlighted in green to be more easy to spot

This is a two-line change across two files and directly fixes the stale cache problem.
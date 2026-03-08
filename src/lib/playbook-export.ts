import { format } from 'date-fns';

export const formatIssueForExport = (issue: any) => {
  const lines = [
    `# ${issue.title}`,
    '',
    `**Category:** ${issue.category}`,
    `**Status:** ${issue.status}`,
    `**Reported:** ${format(new Date(issue.created_at), 'MMM dd, yyyy')}`,
    `**Times Reported:** ${issue.report_count || 1}`,
    '',
    '## Description',
    issue.description || '_No description_',
    '',
  ];

  if (issue.internal_fix) {
    lines.push('## ✅ Verified Fix', issue.internal_fix, '');
  }
  if (issue.ai_suggested_fix) {
    lines.push('## 🤖 AI Suggested Fix', issue.ai_suggested_fix, '');
  }
  if (issue.web_fix) {
    lines.push('## 🌐 Web Fix', issue.web_fix, '');
  }

  return lines.join('\n');
};

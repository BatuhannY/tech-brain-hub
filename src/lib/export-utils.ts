export interface ExportableIssue {
  title: string;
  description: string | null;
  category: string;
  status: string;
  report_count: number;
  kb_proposed: boolean;
  created_at: string;
  internal_fix: string | null;
  ai_suggested_fix: string | null;
  web_fix: string | null;
  solution_steps: string | null;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export function exportAsCSV(issues: ExportableIssue[], filename = 'issues-export.csv') {
  const headers = ['Title', 'Description', 'Category', 'Status', 'Report Count', 'KB Proposed', 'Created At', 'Internal Fix', 'AI Suggested Fix', 'Web Fix'];
  const rows = issues.map(i => [
    i.title,
    i.description || '',
    i.category,
    i.status,
    String(i.report_count || 1),
    i.kb_proposed ? 'Yes' : 'No',
    new Date(i.created_at).toLocaleDateString(),
    stripHtml(i.internal_fix || ''),
    i.ai_suggested_fix || '',
    i.web_fix || '',
  ]);

  const escape = (val: string) => `"${val.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsPDF(issues: ExportableIssue[]) {
  const html = `
    <!DOCTYPE html>
    <html><head>
      <title>Issues Export</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
        .issue { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
        .issue-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .issue-meta { font-size: 11px; color: #666; margin-bottom: 8px; }
        .issue-meta span { margin-right: 12px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
        .fix-section { background: #f9f9f9; border-radius: 6px; padding: 10px; margin-top: 8px; }
        .fix-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 4px; }
        .fix-content { font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <h1>Knowledge Hub — Issues Export</h1>
      <p class="meta">${issues.length} issues · Exported ${new Date().toLocaleDateString()}</p>
      ${issues.map(i => `
        <div class="issue">
          <div class="issue-title">${escapeHtml(i.title)}</div>
          <div class="issue-meta">
            <span>${escapeHtml(i.category)}</span>
            <span>${escapeHtml(i.status)}</span>
            <span>${new Date(i.created_at).toLocaleDateString()}</span>
            ${i.report_count > 1 ? `<span>×${i.report_count}</span>` : ''}
          </div>
          ${i.description ? `<p style="font-size:12px;color:#444;margin:4px 0 8px">${escapeHtml(i.description)}</p>` : ''}
          ${i.internal_fix ? `<div class="fix-section"><div class="fix-label">Internal Fix</div><div class="fix-content">${stripHtml(i.internal_fix)}</div></div>` : ''}
          ${i.ai_suggested_fix ? `<div class="fix-section"><div class="fix-label">AI Suggested Fix</div><div class="fix-content">${escapeHtml(i.ai_suggested_fix)}</div></div>` : ''}
        </div>
      `).join('')}
    </body></html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

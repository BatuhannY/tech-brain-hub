import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Copy, CheckCircle2 } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PlaybookProposals = () => {
  const { data: proposals, isLoading } = useQuery({
    queryKey: ['kb_proposals'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('issue_logs')
        .select('*') as any)
        .eq('kb_proposed', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const formatForExport = (issue: any) => {
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

  const copyToClipboard = (issue: any) => {
    navigator.clipboard.writeText(formatForExport(issue));
    toast.success('Playbook entry copied to clipboard');
  };

  const copyAll = () => {
    if (!proposals?.length) return;
    const all = proposals.map(formatForExport).join('\n\n---\n\n');
    navigator.clipboard.writeText(all);
    toast.success(`${proposals.length} playbook entries copied`);
  };

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>;
  }

  if (!proposals?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BookOpen className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">No playbook proposals yet</p>
        <p className="text-xs text-muted-foreground max-w-xs text-center">
          Toggle "Propose for Knowledge Base" on any issue to add it here for export.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{proposals.length} proposals</span>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={copyAll}>
          <Copy className="h-3.5 w-3.5" />
          Copy All
        </Button>
      </div>

      <div className="space-y-3">
        {proposals.map((issue: any) => (
          <Card key={issue.id} className="shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{issue.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CategoryBadge category={issue.category} />
                    <StatusBadge status={issue.status} />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(issue.created_at), 'MMM dd')}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(issue)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              {issue.description && (
                <p className="text-xs text-muted-foreground">{issue.description}</p>
              )}

              {issue.internal_fix && (
                <div className="rounded-md border border-[hsl(var(--status-resolved))]/20 bg-[hsl(var(--status-resolved))]/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-resolved))]" />
                    <span className="text-[10px] font-semibold text-[hsl(var(--status-resolved))] uppercase tracking-wide">Verified Fix</span>
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-xs [&_p]:text-foreground [&_li]:text-foreground"
                    dangerouslySetInnerHTML={{ __html: issue.internal_fix }}
                  />
                </div>
              )}

              {!issue.internal_fix && issue.ai_suggested_fix && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">AI Fix</span>
                  <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">{issue.ai_suggested_fix}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlaybookProposals;

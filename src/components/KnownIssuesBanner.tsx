import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import CategoryBadge from '@/components/CategoryBadge';

const KnownIssuesBanner = () => {
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('known-issues-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['known_issues'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: issues } = useQuery({
    queryKey: ['known_issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_logs')
        .select('id, title, category, status, report_count')
        .neq('status', 'Resolved')
        .order('report_count', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!issues?.length) return null;

  const grouped = issues.reduce<Record<string, typeof issues>>((acc, issue) => {
    (acc[issue.category] ??= []).push(issue);
    return acc;
  }, {});

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-500/5 rounded-t-lg transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">
                {issues.length} Active Known {issues.length === 1 ? 'Issue' : 'Issues'}
              </span>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-3">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-1.5">
                  <CategoryBadge category={category} />
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <ul className="space-y-1 pl-1">
                  {items.map(issue => (
                    <li key={issue.id} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span className="leading-relaxed">
                        {issue.title}
                        {issue.report_count > 1 && (
                          <span className="text-xs text-muted-foreground ml-1.5">({issue.report_count} reports)</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default KnownIssuesBanner;

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';
import { TrendingUp, Flame } from 'lucide-react';
import { format } from 'date-fns';

const TrendingIssues = () => {
  const { data: issues, isLoading } = useQuery({
    queryKey: ['trending_issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_logs')
        .select('*')
        .order('report_count', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>;
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">No trending issues yet</p>
      </div>
    );
  }

  return (
    <Card className="shadow-none overflow-hidden divide-y divide-border">
      {issues.map(issue => (
        <div key={issue.id} className="p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-medium text-sm text-foreground">{issue.title}</span>
                {(issue.report_count || 1) > 3 && (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1 text-[10px]">
                    <Flame className="h-3 w-3" />
                    Frequent
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CategoryBadge category={issue.category} />
                <StatusBadge status={issue.status} />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(issue.created_at), 'MMM dd, yyyy')}
                </span>
              </div>
              {issue.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{issue.description}</p>
              )}
            </div>
            <div className="flex flex-col items-center shrink-0 bg-accent rounded-lg px-3 py-1.5">
              <span className="text-lg font-bold text-foreground">{issue.report_count || 1}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">reports</span>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
};

export default TrendingIssues;

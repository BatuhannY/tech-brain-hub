import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitBranch, Link2 } from 'lucide-react';
import CategoryBadge from '@/components/CategoryBadge';
import StatusBadge from '@/components/StatusBadge';

interface RelatedItem {
  index: number;
  relevance: string;
  connection: string;
}

interface RelatedIntelligenceProps {
  issueId: string;
  issueTitle: string;
  issueDescription: string | null;
}

const relevanceColor: Record<string, string> = {
  high: 'bg-[hsl(var(--status-resolved))]/10 text-[hsl(var(--status-resolved))]',
  medium: 'bg-[hsl(var(--status-pending))]/10 text-[hsl(var(--status-pending))]',
  low: 'bg-muted text-muted-foreground',
};

const RelatedIntelligence = ({ issueId, issueTitle, issueDescription }: RelatedIntelligenceProps) => {
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const { data: allIssues } = useQuery({
    queryKey: ['issue_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('issue_logs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    setFetched(false);
    setRelated([]);
  }, [issueId]);

  useEffect(() => {
    if (!allIssues || allIssues.length < 2 || fetched) return;
    const otherIssues = allIssues.filter(i => i.id !== issueId);
    if (otherIssues.length === 0) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-analytics', {
          body: {
            mode: 'related-issues',
            issueTitle,
            issueDescription: issueDescription || '',
            issues: otherIssues.map(i => ({ title: i.title, description: i.description, category: i.category })),
          },
        });
        if (error) throw error;
        if (data?.related) {
          const validRelated = data.related
            .filter((r: RelatedItem) => r.index >= 0 && r.index < otherIssues.length)
            .map((r: RelatedItem) => ({
              ...r,
              issue: otherIssues[r.index],
            }));
          setRelated(validRelated);
        }
      } catch (err) {
        console.error('Related intelligence error:', err);
      } finally {
        setLoading(false);
        setFetched(true);
      }
    };

    analyze();
  }, [allIssues, issueId, issueTitle, issueDescription, fetched]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Finding related issues…
      </div>
    );
  }

  if (related.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 text-primary" />
        Related Intelligence
      </h4>
      <div className="space-y-2">
        {related.slice(0, 5).map((item: any, i) => (
          <Card key={i} className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-xs font-medium text-foreground truncate">{item.issue.title}</span>
                    <Badge className={`text-[9px] ${relevanceColor[item.relevance] || relevanceColor.low}`}>
                      {item.relevance}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.connection}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <CategoryBadge category={item.issue.category} />
                    <StatusBadge status={item.issue.status} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RelatedIntelligence;

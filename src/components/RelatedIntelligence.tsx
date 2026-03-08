import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, GitBranch, Link2, RefreshCw } from 'lucide-react';
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
  onIssueSelect?: (issueId: string) => void;
}

const relevanceColor: Record<string, string> = {
  high: 'bg-[hsl(var(--status-resolved))]/10 text-[hsl(var(--status-resolved))]',
  medium: 'bg-[hsl(var(--status-pending))]/10 text-[hsl(var(--status-pending))]',
  low: 'bg-muted text-muted-foreground',
};

// Simple in-memory cache to prevent duplicate calls from desktop+mobile renders
const cache = new Map<string, { related: any[]; timestamp: number }>();
const CACHE_TTL = 60_000; // 1 minute
const pendingRequests = new Map<string, Promise<any>>();

const RelatedIntelligence = ({ issueId, issueTitle, issueDescription, onIssueSelect }: RelatedIntelligenceProps) => {
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const abortRef = useRef(false);

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
    setError(null);
  }, [issueId]);

  useEffect(() => {
    if (!allIssues || allIssues.length < 2 || fetched) return;
    const otherIssues = allIssues.filter(i => i.id !== issueId);
    if (otherIssues.length === 0) return;

    // Check cache first
    const cached = cache.get(issueId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setRelated(cached.related);
      setFetched(true);
      return;
    }

    abortRef.current = false;

    const analyze = async () => {
      setLoading(true);
      setError(null);

      try {
        // Deduplicate: if a request for this issueId is already in flight, reuse it
        let promise = pendingRequests.get(issueId);
        if (!promise) {
          promise = supabase.functions.invoke('ai-analytics', {
            body: {
              mode: 'related-issues',
              issueTitle,
              issueDescription: issueDescription || '',
              issues: otherIssues.map(i => ({ title: i.title, description: i.description, category: i.category })),
            },
          });
          pendingRequests.set(issueId, promise);
        }

        const { data, error: fnError } = await promise;
        pendingRequests.delete(issueId);

        if (abortRef.current) return;
        if (fnError) throw fnError;

        // Handle edge function returning error in body (rate limit, etc.)
        if (data?.error) {
          setError(data.error);
          return;
        }

        if (data?.related) {
          const validRelated = data.related
            .filter((r: RelatedItem) => r.index >= 0 && r.index < otherIssues.length)
            .map((r: RelatedItem) => ({
              ...r,
              issue: otherIssues[r.index],
            }));
          setRelated(validRelated);
          cache.set(issueId, { related: validRelated, timestamp: Date.now() });
        }
      } catch (err: any) {
        pendingRequests.delete(issueId);
        if (!abortRef.current) {
          console.error('Related intelligence error:', err);
          setError('Failed to load related issues');
        }
      } finally {
        if (!abortRef.current) {
          setLoading(false);
          setFetched(true);
        }
      }
    };

    analyze();

    return () => { abortRef.current = true; };
  }, [allIssues, issueId, issueTitle, issueDescription, fetched]);

  const retry = () => {
    cache.delete(issueId);
    setFetched(false);
    setRelated([]);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Finding related issues…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 py-2">
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={retry}>
          <RefreshCw className="h-3 w-3" /> Retry
        </Button>
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
          <Card
            key={i}
            className="shadow-none cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onIssueSelect?.(item.issue.id)}
          >
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

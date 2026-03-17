import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Target, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useAIStatus } from '@/hooks/useAIStatus';

interface RootCauseData {
  root_cause_title: string;
  root_cause_description: string;
  confidence: number;
  affected_categories: string[];
  affected_issue_count: number;
  recommended_actions: string[];
  supporting_evidence: string[];
}

const GlobalInsights = () => {
  const [insight, setInsight] = useState<RootCauseData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { data: issues } = useQuery({
    queryKey: ['issue_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('issue_logs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const runAnalysis = async () => {
    if (!issues?.length) { toast.error('No issues to analyze'); return; }
    setAnalyzing(true);
    try {
      const last50 = issues.slice(0, 50);
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: { mode: 'root-cause', issues: last50 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsight(data);
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const confidenceColor = (c: number) =>
    c >= 75 ? 'text-[hsl(var(--status-resolved))]' : c >= 50 ? 'text-[hsl(var(--status-pending))]' : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Global Insights
        </h3>
        <Button onClick={runAnalysis} disabled={analyzing} variant="outline" size="sm" className="gap-1.5">
          {analyzing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</> : <><Target className="h-3.5 w-3.5" /> Root Cause Analysis</>}
        </Button>
      </div>

      {insight && (
        <Card className="shadow-none border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-xs text-primary uppercase tracking-wide font-semibold mb-1">Master Insight</p>
              <h4 className="text-lg font-bold text-foreground">{insight.root_cause_title}</h4>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{insight.root_cause_description}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className={`font-semibold ${confidenceColor(insight.confidence)}`}>{insight.confidence}%</span>
                <span className="text-muted-foreground">confidence</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--status-pending))]" />
                <span className="font-semibold text-foreground">{insight.affected_issue_count}</span>
                <span className="text-muted-foreground">affected issues</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {insight.affected_categories.map(cat => (
                <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Recommended Actions</p>
              <ul className="space-y-1.5">
                {insight.recommended_actions.map((action, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-resolved))] mt-0.5 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Supporting Evidence</p>
              <ul className="space-y-1">
                {insight.supporting_evidence.map((ev, i) => (
                  <li key={i} className="text-xs text-muted-foreground italic">• {ev}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GlobalInsights;

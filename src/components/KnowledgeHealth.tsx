import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, BookOpen, AlertTriangle, TrendingUp, Zap, Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface KnowledgeHealthProps {
  onCreateIssue?: (title: string, description: string) => void;
}

interface ContentGap {
  category: string;
  issue_count: number;
  fix_count: number;
  gap_severity: string;
  description: string;
}

interface SuggestedGuide {
  title: string;
  category: string;
  rationale: string;
  outline: string[];
}

interface HealthData {
  overall_health_score: number;
  total_issues: number;
  issues_with_fixes: number;
  content_gaps: ContentGap[];
  suggested_guides: SuggestedGuide[];
}

const severityColor: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-[hsl(var(--status-pending))]/15 text-[hsl(var(--status-pending))]',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

const KnowledgeHealth = ({ onCreateIssue }: KnowledgeHealthProps = {}) => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
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
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: { mode: 'knowledge-health', issues },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHealthData(data);
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 75 ? 'text-[hsl(var(--status-resolved))]' : score >= 50 ? 'text-[hsl(var(--status-pending))]' : 'text-destructive';

  return (
    <div className="space-y-5">
      {!healthData ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Knowledge Base Health Check</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                AI will analyze your issue logs to find content gaps and suggest proactive guides to write.
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={analyzing} className="gap-2 rounded-full">
              {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Zap className="h-4 w-4" /> Run Health Check</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score */}
          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Health Score</p>
                  <p className={`text-4xl font-bold mt-1 ${scoreColor(healthData.overall_health_score)}`}>
                    {healthData.overall_health_score}<span className="text-lg text-muted-foreground">/100</span>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1.5">
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                  Re-analyze
                </Button>
              </div>
              <Progress value={healthData.overall_health_score} className="h-2" />
              <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                <span>{healthData.total_issues} total issues</span>
                <span>•</span>
                <span>{healthData.issues_with_fixes} with fixes</span>
              </div>
            </CardContent>
          </Card>

          {/* Content Gaps */}
          {healthData.content_gaps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-pending))]" />
                Content Gaps
              </h3>
              <div className="space-y-2">
                {healthData.content_gaps.map((gap, i) => (
                  <Card key={i} className="shadow-none">
                    <CardContent className="p-3 flex items-start gap-3">
                      <Badge className={`text-[10px] shrink-0 ${severityColor[gap.gap_severity] || severityColor.low}`}>
                        {gap.gap_severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{gap.category}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{gap.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {gap.issue_count} issues / {gap.fix_count} fixes
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Guides */}
          {healthData.suggested_guides.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-primary" />
                Suggested Proactive Guides
              </h3>
              <div className="space-y-3">
                {healthData.suggested_guides.map((guide, i) => (
                  <Card key={i} className="shadow-none border-primary/10">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-medium">{guide.title}</CardTitle>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{guide.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{guide.rationale}</p>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">Outline</p>
                      <ul className="space-y-1">
                        {guide.outline.map((step, j) => (
                          <li key={j} className="text-xs text-foreground flex items-start gap-2">
                            <TrendingUp className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default KnowledgeHealth;

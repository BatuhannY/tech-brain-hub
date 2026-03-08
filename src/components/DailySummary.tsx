import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sunrise, Trophy, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface DailySummaryData {
  key_wins: string;
  emerging_trends: string;
  recommended_focus: string;
}

const DailySummary = ({ issues }: { issues: any[] }) => {
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const generate = async () => {
    if (!issues?.length) { toast.error('No issues to analyze'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: {
          mode: 'daily-summary',
          issues: issues.slice(0, 80).map(i => ({
            title: i.title, category: i.category, status: i.status,
            created_at: i.created_at, updated_at: i.updated_at,
            report_count: i.report_count, has_fix: !!(i.internal_fix || i.ai_suggested_fix),
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate daily summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (issues?.length && !autoLoaded && !summary) {
      setAutoLoaded(true);
      generate();
    }
  }, [issues]);

  const bullets = summary ? [
    { icon: Trophy, label: 'Key Wins', text: summary.key_wins, color: 'text-[hsl(var(--status-resolved))]' },
    { icon: TrendingUp, label: 'Emerging Trends', text: summary.emerging_trends, color: 'text-[hsl(var(--status-pending))]' },
    { icon: Target, label: 'Recommended Focus', text: summary.recommended_focus, color: 'text-primary' },
  ] : [];

  return (
    <Card className="shadow-none border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunrise className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Daily Summary</CardTitle>
          </div>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={generate} disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && !summary ? (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing last 24 hours…
          </div>
        ) : summary ? (
          <div className="space-y-3">
            {bullets.map(b => (
              <div key={b.label} className="flex items-start gap-2.5">
                <b.icon className={`h-4 w-4 mt-0.5 shrink-0 ${b.color}`} />
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${b.color}`}>{b.label}</p>
                  <p className="text-sm text-foreground leading-relaxed mt-0.5">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-3">No data available yet.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default DailySummary;

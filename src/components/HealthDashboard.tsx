import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, eachWeekOfInterval, subWeeks } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import DailySummary from '@/components/DailySummary';

const HealthDashboard = () => {
  const [statusReport, setStatusReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: issues, isLoading } = useQuery({
    queryKey: ['issue_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Bar chart: Issues by Category
  const categoryData = useMemo(() => {
    if (!issues?.length) return [];
    const counts: Record<string, number> = {};
    issues.forEach((i) => {
      counts[i.category] = (counts[i.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  // Line chart: Report volume over time (weekly)
  const volumeData = useMemo(() => {
    if (!issues?.length) return [];
    const now = new Date();
    const start = subWeeks(now, 11);
    const weeks = eachWeekOfInterval({ start, end: now });
    
    return weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = issues.filter((i) => {
        const d = new Date(i.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      return {
        week: format(weekStart, 'MMM dd'),
        issues: count,
      };
    });
  }, [issues]);

  const generateStatusReport = async () => {
    if (!issues?.length) { toast.error('No issues to analyze'); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: {
          mode: 'status-report',
          issues: issues.slice(0, 50).map((i) => ({
            title: i.title,
            category: i.category,
            status: i.status,
            created_at: i.created_at,
            report_count: i.report_count,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStatusReport(data.report);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate status report');
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>;
  }

  const totalCount = issues?.length ?? 0;
  const validatedCount = issues?.filter((i) => i.status === 'Resolved').length ?? 0;
  const unresolvedCount = issues?.filter((i) => i.status === 'Unresolved').length ?? 0;

  return (
    <div className="space-y-5">
      {/* Daily Summary */}
      <DailySummary issues={issues ?? []} />

      {/* Status Report */}
      <Card className="shadow-none border-primary/20">
        <CardContent className="p-4">
          {statusReport ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Activity className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {statusReport}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={generateStatusReport}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Generate an AI status report</span>
              </div>
              <Button
                onClick={generateStatusReport}
                disabled={generating}
                size="sm"
                className="gap-1.5 rounded-full"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: totalCount, color: 'text-foreground' },
          { label: 'Validated', value: validatedCount, color: 'text-status-resolved' },
          { label: 'Unresolved', value: unresolvedCount, color: 'text-status-pending' },
        ].map((s) => (
          <Card key={s.label} className="shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Issues by Category - Bar Chart */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Issues by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Report Volume Over Time - Line Chart */}
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Report Volume Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {volumeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={volumeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="issues"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthDashboard;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, CheckCircle2, Shield, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import CategoryBadge from '@/components/CategoryBadge';

interface PlaybookEntry {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  prevention: string;
}

const PlaybookView = () => {
  const [filter, setFilter] = useState('');
  const [entries, setEntries] = useState<PlaybookEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

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

  const validatedIssues = (issues ?? []).filter(
    (i) => i.status === 'Validated' && i.internal_fix
  );

  const generatePlaybook = async () => {
    if (!validatedIssues.length) {
      toast.error('No validated issues with fixes to generate playbook from');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: {
          mode: 'generate-playbook',
          issues: validatedIssues.map((i) => ({
            id: i.id,
            title: i.title,
            category: i.category,
            description: i.description,
            internal_fix: i.internal_fix,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEntries(data.entries || []);
      setGenerated(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate playbook');
    } finally {
      setGenerating(false);
    }
  };

  const filtered = entries.filter(
    (e) =>
      e.title.toLowerCase().includes(filter.toLowerCase()) ||
      e.category.toLowerCase().includes(filter.toLowerCase()) ||
      e.summary.toLowerCase().includes(filter.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
    );
  }

  if (!generated) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">IT Playbook</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Generate a clean, user-friendly playbook from your {validatedIssues.length} validated fixes. Each entry is AI-refined with a summary, step-by-step fix, and prevention tip.
            </p>
          </div>
          <Button
            onClick={generatePlaybook}
            disabled={generating || !validatedIssues.length}
            className="gap-2 rounded-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate Playbook
              </>
            )}
          </Button>
          {!validatedIssues.length && (
            <p className="text-xs text-muted-foreground">
              No validated issues with fixes yet. Validate some issues first in the Issues tab.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search playbook entries…"
          className="pl-10 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} playbook {filtered.length === 1 ? 'entry' : 'entries'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={generatePlaybook}
          disabled={generating}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {filtered.map((entry) => (
          <Card key={entry.id} className="shadow-none hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold leading-snug">
                  {entry.title}
                </CardTitle>
                <CategoryBadge category={entry.category} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Summary */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Issue Summary
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {entry.summary}
                </p>
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-resolved" />
                  <span className="text-xs font-semibold text-status-resolved uppercase tracking-wide">
                    Step-by-Step Fix
                  </span>
                </div>
                <ol className="space-y-1.5">
                  {entry.steps.map((step, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2.5">
                      <span className="text-xs font-mono font-bold text-muted-foreground mt-0.5 shrink-0 w-5 text-right">
                        {i + 1}.
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Prevention */}
              <div className="rounded-lg bg-accent/50 border border-border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Prevention Tip
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {entry.prevention}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No entries match your search.</p>
        </div>
      )}
    </div>
  );
};

export default PlaybookView;

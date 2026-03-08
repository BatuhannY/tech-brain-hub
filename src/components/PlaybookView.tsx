import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, CheckCircle2, Shield, Lightbulb, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import CategoryBadge from '@/components/CategoryBadge';
import DynamicFAQ from '@/components/DynamicFAQ';
import KnownIssuesBanner from '@/components/KnownIssuesBanner';

interface RefinedEntry {
  id: string;
  summary: string;
  steps: string[];
  prevention: string;
}

const PlaybookView = () => {
  const [filter, setFilter] = useState('');
  const [refinedMap, setRefinedMap] = useState<Record<string, RefinedEntry>>({});
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set());
  const [bulkRefining, setBulkRefining] = useState(false);
  const queryClient = useQueryClient();

  // Realtime subscription to auto-refresh when issues change
  useEffect(() => {
    const channel = supabase
      .channel('playbook-issue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issue_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['playbook_issues'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: issues, isLoading } = useQuery({
    queryKey: ['playbook_issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_logs')
        .select('*')
        .in('status', ['Resolved'])
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const playbookIssues = issues ?? [];

  // Auto-refine new entries whenever issues change
  const [autoRefiningIds, setAutoRefiningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!playbookIssues.length || bulkRefining) return;
    const unrefined = playbookIssues.filter(i => !refinedMap[i.id] && !autoRefiningIds.has(i.id) && !refiningIds.has(i.id));
    if (!unrefined.length) return;

    const ids = unrefined.map(i => i.id);
    setAutoRefiningIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-analytics', {
          body: {
            mode: 'generate-playbook',
            issues: unrefined.map(i => ({ id: i.id, title: i.title, category: i.category, description: i.description, internal_fix: i.internal_fix })),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setRefinedMap(prev => {
          const newMap = { ...prev };
          (data.entries || []).forEach((e: any) => {
            newMap[e.id] = { id: e.id, summary: e.summary, steps: e.steps, prevention: e.prevention };
          });
          return newMap;
        });
      } catch (err: any) {
        console.error('Auto-refine failed:', err);
      }
    })();
  }, [playbookIssues]);

  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const parseSteps = (fix: string | null): string[] => {
    if (!fix) return ['No fix details available.'];
    // If HTML contains list items, extract each <li> as a step
    if (fix.includes('<li>')) {
      const doc = new DOMParser().parseFromString(fix, 'text/html');
      const items = doc.querySelectorAll('li');
      if (items.length > 0) {
        return Array.from(items).map(li => (li.textContent || '').trim()).filter(Boolean);
      }
    }
    // Fallback: strip HTML, then split by numbered steps, newlines, or bullet points
    const clean = stripHtml(fix);
    const lines = clean.split(/\n|(?=\d+\.\s)/).map(l => l.replace(/^[\d]+\.\s*/, '').replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    return lines.length > 0 ? lines : [clean];
  };

  const refineWithAI = async (issue: any) => {
    setRefiningIds(prev => new Set(prev).add(issue.id));
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: {
          mode: 'generate-playbook',
          issues: [{ id: issue.id, title: issue.title, category: issue.category, description: issue.description, internal_fix: issue.internal_fix }],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const entry = data.entries?.[0];
      if (entry) {
        setRefinedMap(prev => ({ ...prev, [issue.id]: { id: entry.id, summary: entry.summary, steps: entry.steps, prevention: entry.prevention } }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to refine entry');
    } finally {
      setRefiningIds(prev => { const s = new Set(prev); s.delete(issue.id); return s; });
    }
  };

  const refineAll = async () => {
    const unrefined = playbookIssues.filter(i => !refinedMap[i.id]);
    if (!unrefined.length) { toast.info('All entries are already refined'); return; }
    setBulkRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: {
          mode: 'generate-playbook',
          issues: unrefined.map(i => ({ id: i.id, title: i.title, category: i.category, description: i.description, internal_fix: i.internal_fix })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newMap: Record<string, RefinedEntry> = { ...refinedMap };
      (data.entries || []).forEach((e: any) => { newMap[e.id] = { id: e.id, summary: e.summary, steps: e.steps, prevention: e.prevention }; });
      setRefinedMap(newMap);
      toast.success(`Refined ${data.entries?.length || 0} entries`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to refine entries');
    } finally {
      setBulkRefining(false);
    }
  };

  const filtered = playbookIssues.filter(i =>
    i.title.toLowerCase().includes(filter.toLowerCase()) ||
    i.category.toLowerCase().includes(filter.toLowerCase())
  );

  if (isLoading) {
    return <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>;
  }

  if (!playbookIssues.length) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <p className="font-semibold text-foreground">No Playbook Entries Yet</p>
          <p className="text-sm text-muted-foreground max-w-sm text-center">
            Resolve or validate issues in the Issues tab — they'll automatically appear here as playbook entries.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-5">
      {/* Main playbook content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Dynamic FAQ */}
        {/* FAQ shown inline on mobile only */}
        <div className="lg:hidden">
          <DynamicFAQ issues={playbookIssues} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search playbook entries…" className="pl-10 text-sm" />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={refineAll} disabled={bulkRefining}>
            {bulkRefining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI Refine All
          </Button>
        </div>

        <div className="space-y-4">
          {filtered.map((issue) => {
            const refined = refinedMap[issue.id];
            const isRefining = refiningIds.has(issue.id);
            const steps = refined ? refined.steps : parseSteps(issue.internal_fix);
            const summary = refined?.summary || issue.description || 'No description available.';
            const prevention = refined?.prevention;

            return (
              <Card key={issue.id} className="shadow-none hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-snug">{issue.title}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <CategoryBadge category={issue.category} />
                      {!refined && (
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2" onClick={() => refineWithAI(issue)} disabled={isRefining}>
                          {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Refine
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">Issue Summary</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{summary}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-resolved" />
                      <span className="text-xs font-semibold text-status-resolved uppercase tracking-wide">Step-by-Step Fix</span>
                    </div>
                    <ol className="space-y-1.5">
                      {steps.map((step, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2.5">
                          <span className="text-xs font-mono font-bold text-muted-foreground mt-0.5 shrink-0 w-5 text-right">{i + 1}.</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {prevention && (
                    <div className="rounded-lg bg-accent/50 border border-border p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prevention Tip</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{prevention}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No entries match your search.</p>
          </div>
        )}
      </div>

      {/* Known Issues sidebar card */}
      <div className="w-72 shrink-0 hidden lg:block">
        <div className="sticky top-4">
          <KnownIssuesBanner />
        </div>
      </div>
    </div>
  );
};

export default PlaybookView;

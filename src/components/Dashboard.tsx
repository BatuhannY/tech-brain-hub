import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Bug, Pencil, Trash2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';
import IssueFormDialog from '@/components/IssueFormDialog';
import AISearchBar from '@/components/AISearchBar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type IssueLog = Tables<'issue_logs'>;

const Dashboard = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueLog | null>(null);
  const [searchResults, setSearchResults] = useState<IssueLog[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: issues, refetch, isLoading } = useQuery({
    queryKey: ['issue_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issue_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as IssueLog[];
    },
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('issue_logs').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Issue deleted');
      refetch();
    }
  };

  const displayIssues = searchResults ?? issues ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Terminal className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Knowledge Hub</h1>
              <p className="text-sm text-muted-foreground font-mono">Tech Issues Admin</p>
            </div>
          </div>
          <Button onClick={() => { setEditingIssue(null); setFormOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Issue
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* AI Search */}
        <AISearchBar
          onResults={(results, query) => { setSearchResults(results); setSearchQuery(query); }}
          onClear={() => { setSearchResults(null); setSearchQuery(''); }}
        />

        {searchResults && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">
              AI results for "{searchQuery}" — {searchResults.length} found
            </span>
            <Button variant="ghost" size="sm" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
              Clear
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: issues?.length ?? 0 },
            { label: 'Resolved', value: issues?.filter(i => i.status === 'Resolved').length ?? 0 },
            { label: 'Pending', value: issues?.filter(i => i.status === 'Pending').length ?? 0 },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground font-mono">{s.label}</p>
                <p className="text-2xl font-bold font-mono">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Issue List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground font-mono">Loading issues...</div>
        ) : displayIssues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Bug className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground font-mono">No issues logged yet</p>
              <Button variant="outline" onClick={() => { setEditingIssue(null); setFormOpen(true); }}>
                Log your first issue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {displayIssues.map(issue => (
              <Card
                key={issue.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{issue.title}</h3>
                        <CategoryBadge category={issue.category} />
                        <StatusBadge status={issue.status} />
                      </div>
                      {issue.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{issue.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono mt-2">
                        {format(new Date(issue.created_at), 'MMM dd, yyyy · HH:mm')}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditingIssue(issue); setFormOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(issue.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === issue.id && issue.solution_steps && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground font-mono mb-2">SOLUTION</p>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: issue.solution_steps }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <IssueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        issue={editingIssue}
        onSaved={refetch}
      />
    </div>
  );
};

export default Dashboard;

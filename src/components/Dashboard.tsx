import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Bug, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';
import IssueFormDialog from '@/components/IssueFormDialog';
import AISearchBar from '@/components/AISearchBar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Tables } from '@/integrations/supabase/types';

type IssueLog = Tables<'issue_logs'>;

const Dashboard = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueLog | null>(null);
  const [searchResults, setSearchResults] = useState<IssueLog[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('issue_logs').delete().eq('id', deleteId);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Issue deleted');
      refetch();
    }
    setDeleteId(null);
  };

  const displayIssues = searchResults ?? issues ?? [];

  const totalCount = issues?.length ?? 0;
  const resolvedCount = issues?.filter(i => i.status === 'Resolved').length ?? 0;
  const pendingCount = issues?.filter(i => i.status === 'Pending').length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Knowledge Hub</h1>
          <Button
            onClick={() => { setEditingIssue(null); setFormOpen(true); }}
            size="sm"
            className="rounded-full gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Issue
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* AI Search */}
        <AISearchBar
          onResults={(results, query) => { setSearchResults(results); setSearchQuery(query); }}
          onClear={() => { setSearchResults(null); setSearchQuery(''); }}
        />

        {searchResults && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Results for "{searchQuery}" — {searchResults.length} found
            </span>
            <Button variant="ghost" size="sm" className="text-primary text-sm h-auto p-0" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
              Clear
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: totalCount, color: 'text-foreground' },
            { label: 'Resolved', value: resolvedCount, color: 'text-status-resolved' },
            { label: 'Pending', value: pendingCount, color: 'text-status-pending' },
          ].map(s => (
            <Card key={s.label} className="shadow-none">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Issue List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : displayIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bug className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No issues logged yet</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setEditingIssue(null); setFormOpen(true); }}>
              Log your first issue
            </Button>
          </div>
        ) : (
          <Card className="shadow-none overflow-hidden divide-y divide-border">
            {displayIssues.map(issue => (
              <div key={issue.id}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground truncate">{issue.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={issue.category} />
                      <StatusBadge status={issue.status} />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(issue.created_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditingIssue(issue); setFormOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(issue.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === issue.id ? 'rotate-90' : ''}`} />
                </div>
                {expandedId === issue.id && (
                  <div className="px-4 pb-4 space-y-2">
                    {issue.description && (
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    )}
                    {issue.solution_steps && (
                      <div className="bg-accent/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Solution</p>
                        <div
                          className="prose prose-sm max-w-none text-sm text-foreground [&_p]:text-foreground [&_li]:text-foreground [&_code]:text-foreground"
                          dangerouslySetInnerHTML={{ __html: issue.solution_steps }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </main>

      <IssueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        issue={editingIssue}
        onSaved={refetch}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The issue will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;

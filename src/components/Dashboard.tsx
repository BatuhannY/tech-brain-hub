import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Bug, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';
import IssueFormDialog from '@/components/IssueFormDialog';
import IssueDetail from '@/components/IssueDetail';
import TrendingIssues from '@/components/TrendingIssues';
import AIChat from '@/components/AIChat';
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

const Dashboard = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('issues');

  const { data: issues, refetch, isLoading } = useQuery({
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
  const validatedCount = issues?.filter(i => i.status === 'Validated').length ?? 0;
  const unresolvedCount = issues?.filter(i => i.status === 'Unresolved').length ?? 0;

  const IssuesList = () => (
    <>
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
          { label: 'Validated', value: validatedCount, color: 'text-status-resolved' },
          { label: 'Unresolved', value: unresolvedCount, color: 'text-status-pending' },
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
                    {(issue.report_count || 1) > 1 && (
                      <span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded-full">
                        ×{issue.report_count}
                      </span>
                    )}
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
                <IssueDetail issue={issue} onUpdated={refetch} />
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
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

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="w-full">
            <TabsTrigger value="issues" className="flex-1">All Issues</TabsTrigger>
            <TabsTrigger value="trending" className="flex-1">Trending</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">AI Agent</TabsTrigger>
          </TabsList>
          <div className={activeTab === 'issues' ? 'space-y-5' : 'hidden'}>
            <IssuesList />
          </div>
          <div className={activeTab === 'trending' ? '' : 'hidden'}>
            <TrendingIssues />
          </div>
          <div className={activeTab === 'ai' ? '' : 'hidden'}>
            <AIChat onIssueCreated={refetch} />
          </div>
        </Tabs>
      </main>

      <IssueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        issue={editingIssue}
        onSaved={refetch}
      />

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

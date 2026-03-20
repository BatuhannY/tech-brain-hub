// Dashboard - Admin + Playbook split
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Bug, Pencil, Trash2, ChevronRight, Copy, BookOpen, Download, FileText, FileSpreadsheet, LogOut, Shield, Slack, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import CategoryBadge from '@/components/CategoryBadge';
import IssueFormDialog from '@/components/IssueFormDialog';
import IssueDetail from '@/components/IssueDetail';
import TrendingIssues from '@/components/TrendingIssues';
import AIChat from '@/components/AIChat';
import PlaybookView from '@/components/PlaybookView';
import HealthDashboard from '@/components/HealthDashboard';
import ThemeToggle from '@/components/ThemeToggle';
import { formatIssueForExport } from '@/lib/playbook-export';
import PredictiveSearchBar from '@/components/PredictiveSearchBar';
import KnowledgeHealth from '@/components/KnowledgeHealth';
import { exportAsCSV, exportAsPDF } from '@/lib/export-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GlobalInsights from '@/components/GlobalInsights';
import AIOfflineBanner from '@/components/AIOfflineBanner';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('issues');
  const [kbFilter, setKbFilter] = useState(false);

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

  const baseIssues = searchResults ?? issues ?? [];
  const displayIssues = kbFilter ? baseIssues.filter(i => i.kb_proposed) : baseIssues;
  const totalCount = issues?.length ?? 0;
  const validatedCount = issues?.filter(i => i.status === 'Resolved').length ?? 0;
  const unresolvedCount = issues?.filter(i => i.status === 'Unresolved').length ?? 0;

  const copyIssueAsMarkdown = (issue: any) => {
    navigator.clipboard.writeText(formatIssueForExport(issue));
    toast.success('Copied as Markdown');
  };

  const copyAllKbIssues = () => {
    const kbIssues = (issues ?? []).filter(i => i.kb_proposed);
    if (!kbIssues.length) return;
    const all = kbIssues.map(formatIssueForExport).join('\n\n---\n\n');
    navigator.clipboard.writeText(all);
    toast.success(`${kbIssues.length} KB entries copied`);
  };

  const IssuesList = () => (
    <>
      <PredictiveSearchBar
        onResults={(results, query) => { setSearchResults(results); setSearchQuery(query); }}
        onClear={() => { setSearchResults(null); setSearchQuery(''); }}
        issues={issues ?? []}
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

      <div className="flex items-center justify-between">
        <Button
          variant={kbFilter ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 h-8 rounded-full text-xs"
          onClick={() => setKbFilter(!kbFilter)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          KB Proposed
        </Button>
        {kbFilter && (
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-full" onClick={copyAllKbIssues}>
            <Copy className="h-3.5 w-3.5" />
            Export All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: totalCount, color: 'text-foreground' },
          { label: 'Resolved', value: validatedCount, color: 'text-[hsl(var(--status-resolved))]' },
          { label: 'Unresolved', value: unresolvedCount, color: 'text-[hsl(var(--status-pending))]' },
        ].map(s => (
          <Card key={s.label} className="shadow-none hover:shadow-md transition-all duration-200 bg-gradient-to-br from-card to-card/80">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global Insights */}
      <GlobalInsights />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="shadow-none">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Bug className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-muted-foreground font-medium">No issues logged yet</p>
            <p className="text-muted-foreground/60 text-sm">Get started by logging your first issue</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setEditingIssue(null); setFormOpen(true); }}>
            Log your first issue
          </Button>
        </div>
      ) : (
        <Card className="shadow-none overflow-hidden divide-y divide-border">
          {displayIssues.map(issue => (
            <div key={issue.id} id={`issue-${issue.id}`}>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground truncate">{issue.title}</span>
                    {(issue.report_count || 1) > 1 && (
                      <span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
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
                  {issue.kb_proposed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => copyIssueAsMarkdown(issue)}
                      title="Copy as Markdown"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
                <IssueDetail issue={issue} onUpdated={refetch} onIssueSelect={(id) => {
                  setExpandedId(id);
                  setTimeout(() => {
                    document.getElementById(`issue-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }} />
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background bg-dot-pattern">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Knowledge Hub</h1>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/slack-preview')}
              title="Slack Preview"
            >
              <Slack className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/integrations')}
              title="Integrations"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={async () => { await signOut(); navigate('/admin'); }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { if (issues?.length) exportAsCSV(issues); else toast.error('No issues to export'); }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (issues?.length) exportAsPDF(issues); else toast.error('No issues to export'); }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => { setEditingIssue(null); setFormOpen(true); }}
              size="sm"
              className="rounded-full gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Issue
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <AIOfflineBanner />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full bg-secondary/60 p-1 rounded-xl h-auto">
            <TabsTrigger value="issues" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Issues</TabsTrigger>
            <TabsTrigger value="playbook" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Playbook</TabsTrigger>
            <TabsTrigger value="health" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Health</TabsTrigger>
            <TabsTrigger value="trending" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Trending</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 text-xs py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">AI Agent</TabsTrigger>
          </TabsList>
          <div className={activeTab === 'issues' ? 'space-y-5' : 'hidden'}>
            <IssuesList />
          </div>
          <div className={activeTab === 'playbook' ? '' : 'hidden'}>
            <PlaybookView isAdmin />
          </div>
          <div className={activeTab === 'health' ? '' : 'hidden'}>
            <HealthDashboard />
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

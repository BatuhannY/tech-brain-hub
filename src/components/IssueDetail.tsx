import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Bot, Globe, Wrench, BookOpen, Sparkles, Pencil, Save, X } from 'lucide-react';
import RelatedIntelligence from '@/components/RelatedIntelligence';
import RichTextEditor from '@/components/RichTextEditor';
import DraftTeamUpdate from '@/components/DraftTeamUpdate';

interface IssueDetailProps {
  issue: any;
  onUpdated: () => void;
  onIssueSelect?: (issueId: string) => void;
}

const IssueDetail = ({ issue, onUpdated, onIssueSelect }: IssueDetailProps) => {
  const [validating, setValidating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [editingFix, setEditingFix] = useState(false);
  const [editFixContent, setEditFixContent] = useState('');
  const [savingFix, setSavingFix] = useState(false);

  const handleStartEditFix = () => {
    setEditFixContent(issue.internal_fix || '');
    setEditingFix(true);
  };

  const handleSaveFix = async () => {
    setSavingFix(true);
    try {
      const { error } = await supabase
        .from('issue_logs')
        .update({ internal_fix: editFixContent, solution_steps: editFixContent } as any)
        .eq('id', issue.id);
      if (error) throw error;
      toast.success('Internal fix updated');
      setEditingFix(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update fix');
    } finally {
      setSavingFix(false);
    }
  };

  const handleValidateFix = async () => {
    setValidating(true);
    try {
      // Merge AI + Web fix content
      const merged = [issue.ai_suggested_fix, issue.web_fix].filter(Boolean).join('\n\n---\n\n');
      const { error } = await supabase
        .from('issue_logs')
        .update({
          internal_fix: merged,
          solution_steps: merged,
          status: 'Resolved',
        } as any)
        .eq('id', issue.id);
      if (error) throw error;
      toast.success('Fix confirmed and promoted to internal fix!');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm fix');
    } finally {
      setValidating(false);
    }
  };

  const handleReject = () => {
    toast.info('Fix rejected. The issue remains unresolved.');
  };

  const handleKbToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('issue_logs')
        .update({ kb_proposed: checked } as any)
        .eq('id', issue.id);
      if (error) throw error;
      toast.success(checked ? 'Proposed for Knowledge Base' : 'Removed from Knowledge Base proposals');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setToggling(false);
    }
  };

  const hasAiFix = !!issue.ai_suggested_fix;
  const hasWebFix = !!issue.web_fix;
  const hasCombinedFix = hasAiFix || hasWebFix;

  return (
    <div className="px-4 pb-4">
      <div className="flex gap-4">
        {/* Left: Issue Details */}
        <div className="flex-1 min-w-0 space-y-3">
          {issue.description && (
            <p className="text-sm text-muted-foreground">{issue.description}</p>
          )}

          {/* Internal Fix — always first */}
          {(issue.internal_fix || editingFix) && (
            <Card className="shadow-none border-[hsl(var(--status-resolved))]/20 bg-[hsl(var(--status-resolved))]/5">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-[hsl(var(--status-resolved))]" />
                    <span className="text-xs font-semibold text-[hsl(var(--status-resolved))] uppercase tracking-wide">Internal Fix</span>
                  </div>
                  {!editingFix ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleStartEditFix}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-[hsl(var(--status-resolved))]" onClick={handleSaveFix} disabled={savingFix}>
                        <Save className="h-3 w-3" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => setEditingFix(false)}>
                        <X className="h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>
                {editingFix ? (
                  <RichTextEditor content={editFixContent} onChange={setEditFixContent} placeholder="Write internal fix steps..." />
                ) : (
                  <div
                    className="prose prose-sm max-w-none text-sm [&_p]:text-foreground [&_li]:text-foreground"
                    dangerouslySetInnerHTML={{ __html: issue.internal_fix }}
                  />
                )}
              </CardContent>
            </Card>
          )}
          {/* Add fix button when no internal fix exists */}
          {!issue.internal_fix && !editingFix && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleStartEditFix}>
              <Wrench className="h-3 w-3" /> Add Internal Fix
            </Button>
          )}

          {/* Combined AI + Web Fix */}
          {hasCombinedFix && (
            <Card className="shadow-none border-primary/20 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI + Web Intelligence</span>
                  </div>
                  {issue.status !== 'Validated' && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-1">Promote to fix?</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-[hsl(var(--status-resolved))] hover:bg-[hsl(var(--status-resolved))]/10 gap-1"
                        onClick={handleValidateFix}
                        disabled={validating}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                        onClick={handleReject}
                      >
                        <XCircle className="h-3.5 w-3.5" /> No
                      </Button>
                    </div>
                  )}
                </div>

                {hasAiFix && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Bot className="h-3 w-3 text-primary/70" />
                      <span className="text-[10px] font-medium text-primary/70 uppercase tracking-wider">AI Analysis</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{issue.ai_suggested_fix}</p>
                  </div>
                )}

                {hasWebFix && (
                  <>
                    {hasAiFix && <div className="border-t border-primary/10 my-2" />}
                    <p className="text-sm text-foreground whitespace-pre-wrap">{issue.web_fix}</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Legacy solution_steps fallback */}
          {!issue.internal_fix && !hasCombinedFix && issue.solution_steps && (
            <Card className="shadow-none bg-accent/50">
              <CardContent className="p-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Solution</span>
                <div
                  className="prose prose-sm max-w-none text-sm [&_p]:text-foreground [&_li]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: issue.solution_steps }}
                />
              </CardContent>
            </Card>
          )}

          {/* Draft Team Update for validated issues */}
          <DraftTeamUpdate issue={issue} />

          {/* Knowledge Base Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-accent/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <Label htmlFor={`kb-${issue.id}`} className="text-xs font-medium cursor-pointer">
                Propose for Knowledge Base
              </Label>
            </div>
            <Switch
              id={`kb-${issue.id}`}
              checked={issue.kb_proposed ?? false}
              onCheckedChange={handleKbToggle}
              disabled={toggling}
            />
          </div>
        </div>

        {/* Right: Related Intelligence sidebar */}
        <div className="w-72 shrink-0 hidden md:block">
          <Card className="shadow-none sticky top-20">
            <CardContent className="p-3">
              <RelatedIntelligence
                issueId={issue.id}
                issueTitle={issue.title}
                issueDescription={issue.description}
                onIssueSelect={onIssueSelect}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile: Related Intelligence below */}
      <div className="mt-3 md:hidden">
        <Card className="shadow-none">
          <CardContent className="p-3">
            <RelatedIntelligence
              issueId={issue.id}
              issueTitle={issue.title}
              issueDescription={issue.description}
              onIssueSelect={onIssueSelect}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IssueDetail;

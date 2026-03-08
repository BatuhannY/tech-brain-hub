import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RichTextEditor from '@/components/RichTextEditor';
import QuickImport from '@/components/QuickImport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, Bot, CheckCircle2, ArrowRight, Search } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

type IssueLog = Tables<'issue_logs'>;

interface IssueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: IssueLog | null;
  onSaved: () => void;
}

const CATEGORIES = ['Bug', 'Network', 'Access', 'Hardware', 'Software', 'Security', 'Other'];

interface CopilotSuggestion {
  match_found: boolean;
  match_index: number;
  match_title?: string;
  match_id?: string;
  match_status?: string;
  existing_fix?: string;
  proposed_draft_fix?: string;
  suggested_category?: string;
}

const IssueFormDialog = ({ open, onOpenChange, issue, onSaved }: IssueFormDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Bug');
  const [internalFix, setInternalFix] = useState('');
  const [status, setStatus] = useState('Unresolved');
  const [saving, setSaving] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // Copilot states
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotSuggestion, setCopilotSuggestion] = useState<CopilotSuggestion | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftingFix, setDraftingFix] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setCategory(issue.category);
      setInternalFix((issue as any).internal_fix || issue.solution_steps || '');
      setStatus(issue.status);
    } else {
      setTitle('');
      setDescription('');
      setCategory('Bug');
      setInternalFix('');
      setStatus('Unresolved');
    }
    setCopilotSuggestion(null);
    setSheetOpen(false);
  }, [issue, open]);

  const triggerCopilot = useCallback(async (titleText: string) => {
    if (titleText.trim().length < 5 || issue) return;
    setCopilotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: { title: titleText.trim(), description: description.trim(), mode: 'suggest' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCopilotSuggestion(data);
      if (data.suggested_category) setCategory(data.suggested_category);
      if (data.match_found && data.existing_fix) {
        setSheetOpen(true);
      }
    } catch (err) {
      console.error('Copilot suggest error:', err);
    } finally {
      setCopilotLoading(false);
    }
  }, [description, issue]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 5 && !issue) {
      debounceRef.current = setTimeout(() => triggerCopilot(val), 1200);
    } else {
      setCopilotSuggestion(null);
    }
  };

  const applyExistingFix = () => {
    if (copilotSuggestion?.existing_fix) {
      setInternalFix(copilotSuggestion.existing_fix);
      setSheetOpen(false);
      toast.success('Existing fix applied to resolution field');
    }
  };

  const applyDraftFix = () => {
    if (copilotSuggestion?.proposed_draft_fix) {
      setInternalFix(copilotSuggestion.proposed_draft_fix);
      toast.success('Draft fix applied');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      let finalFix = internalFix;

      // Context-aware drafting: if resolution empty for new issues, auto-generate
      if (!issue && !finalFix.trim()) {
        setDraftingFix(true);
        try {
          const { data, error } = await supabase.functions.invoke('ai-copilot', {
            body: { title: title.trim(), description: description.trim(), mode: 'draft' },
          });
          if (!error && data?.fix_steps) {
            finalFix = data.fix_steps;
            if (data.category) setCategory(data.category);
          }
        } catch (err) {
          console.error('Draft fix error:', err);
        }
        setDraftingFix(false);
      }

      if (issue) {
        const { error } = await supabase
          .from('issue_logs')
          .update({
            title,
            description,
            category,
            solution_steps: finalFix,
            internal_fix: finalFix,
            status,
          } as any)
          .eq('id', issue.id);
        if (error) throw error;
        toast.success('Issue updated');
      } else {
        setAiProcessing(true);
        let aiCategory = category;
        let aiSuggestedFix = '';
        let webFix = '';
        let duplicateId: string | null = null;

        try {
          const { data, error } = await supabase.functions.invoke('ai-categorize', {
            body: { title: title.trim(), description: description.trim() },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          aiCategory = data.category || category;
          aiSuggestedFix = data.ai_suggested_fix || '';
          webFix = data.web_fix || '';
          duplicateId = data.duplicate_id;

          if (duplicateId) {
            toast.info('Similar issue found — report count incremented.');
          }
        } catch (aiErr: any) {
          console.error('AI categorization failed:', aiErr);
          toast.warning('AI categorization failed, saving with manual category.');
        }
        setAiProcessing(false);

        const { error } = await supabase
          .from('issue_logs')
          .insert({
            title,
            description,
            category: aiCategory,
            solution_steps: finalFix,
            internal_fix: finalFix || null,
            ai_suggested_fix: aiSuggestedFix || null,
            web_fix: webFix || null,
            status: finalFix ? 'Validated' : 'Unresolved',
          } as any);
        if (error) throw error;
        toast.success('Issue created with AI analysis');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
      setAiProcessing(false);
      setDraftingFix(false);
    }
  };

  const isProcessing = saving || aiProcessing || draftingFix;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{issue ? 'Edit Issue' : 'Log New Issue'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Title with copilot indicator */}
            <div>
              <Label htmlFor="title">Title</Label>
              <div className="relative">
                <Input
                  id="title"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="e.g., VPN not connecting on macOS"
                />
                {copilotLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-primary">
                    <Search className="h-3.5 w-3.5 animate-pulse" />
                    <span className="text-xs font-medium animate-pulse">AI searching…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Copilot suggestion banner — no match */}
            {!issue && copilotSuggestion && !copilotSuggestion.match_found && copilotSuggestion.proposed_draft_fix && !copilotLoading && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">AI Copilot — Proposed Draft Fix</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {copilotSuggestion.proposed_draft_fix}
                </p>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={applyDraftFix}>
                  <ArrowRight className="h-3 w-3" /> Apply to Resolution
                </Button>
              </div>
            )}

            {/* Copilot match found — inline hint */}
            {!issue && copilotSuggestion?.match_found && !copilotLoading && (
              <div className="rounded-lg border border-[hsl(var(--status-resolved))]/30 bg-[hsl(var(--status-resolved))]/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-resolved))]" />
                    <span className="text-sm font-medium text-[hsl(var(--status-resolved))]">
                      Existing solution found!
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setSheetOpen(true)}>
                    View & Apply <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Matches: "{copilotSuggestion.match_title}"
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue..." rows={3} />
            </div>

            {issue && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unresolved">Unresolved</SelectItem>
                      <SelectItem value="Validated">Validated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {!issue && !copilotSuggestion?.match_found && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Category, AI fix & web fix will be auto-generated by AI on save.
              </p>
            )}

            {/* Resolution field with AI researching state */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Internal Fix (Known Solution)</Label>
                {draftingFix && (
                  <div className="flex items-center gap-1.5 text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs font-medium">AI Researching…</span>
                  </div>
                )}
              </div>
              <RichTextEditor content={internalFix} onChange={setInternalFix} />
              {!issue && !internalFix.trim() && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  If empty, AI will auto-draft a fix on save.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isProcessing} className="gap-2">
                {draftingFix ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> AI Drafting Fix...</>
                ) : aiProcessing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> AI Analyzing...</>
                ) : saving ? 'Saving...' : issue ? 'Update Issue' : (
                  <><Sparkles className="h-4 w-4" /> Save & Analyze</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Side panel for existing solution */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-resolved))]" />
              Existing Solution Found
            </SheetTitle>
            <SheetDescription>
              A similar issue was found in the knowledge base with a verified fix.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {copilotSuggestion?.match_title && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Matched Issue</p>
                <p className="text-sm font-medium text-foreground">{copilotSuggestion.match_title}</p>
                {copilotSuggestion.match_status && (
                  <span className="text-xs text-muted-foreground">Status: {copilotSuggestion.match_status}</span>
                )}
              </div>
            )}
            {copilotSuggestion?.existing_fix && (
              <div className="rounded-lg border border-[hsl(var(--status-resolved))]/20 bg-[hsl(var(--status-resolved))]/5 p-4">
                <p className="text-xs font-semibold text-[hsl(var(--status-resolved))] uppercase tracking-wide mb-2">Resolution Steps</p>
                <div
                  className="prose prose-sm max-w-none text-sm [&_p]:text-foreground [&_li]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: copilotSuggestion.existing_fix }}
                />
              </div>
            )}
            <Button className="w-full gap-2" onClick={applyExistingFix}>
              <ArrowRight className="h-4 w-4" />
              Apply these steps
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default IssueFormDialog;

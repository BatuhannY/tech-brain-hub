import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RichTextEditor from '@/components/RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type IssueLog = Tables<'issue_logs'>;

interface IssueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: IssueLog | null;
  onSaved: () => void;
}

const CATEGORIES = ['Bug', 'Network', 'Access', 'Hardware', 'Software', 'Security', 'Other'];

const IssueFormDialog = ({ open, onOpenChange, issue, onSaved }: IssueFormDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Bug');
  const [internalFix, setInternalFix] = useState('');
  const [status, setStatus] = useState('Unresolved');
  const [saving, setSaving] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

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
  }, [issue, open]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (issue) {
        const { error } = await supabase
          .from('issue_logs')
          .update({
            title,
            description,
            category,
            solution_steps: internalFix,
            internal_fix: internalFix,
            status,
          } as any)
          .eq('id', issue.id);
        if (error) throw error;
        toast.success('Issue updated');
      } else {
        // AI categorization for new issues
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
            solution_steps: internalFix,
            internal_fix: internalFix || null,
            ai_suggested_fix: aiSuggestedFix || null,
            web_fix: webFix || null,
            status: internalFix ? 'Validated' : 'Unresolved',
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
    }
  };

  const isProcessing = saving || aiProcessing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{issue ? 'Edit Issue' : 'Log New Issue'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., VPN not connecting on macOS" />
          </div>
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
          {!issue && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Category, AI fix & web fix will be auto-generated by AI on save.
            </p>
          )}
          <div>
            <Label>Internal Fix (Known Solution)</Label>
            <RichTextEditor content={internalFix} onChange={setInternalFix} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isProcessing} className="gap-2">
              {aiProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> AI Analyzing...</>
              ) : saving ? 'Saving...' : issue ? 'Update Issue' : (
                <><Sparkles className="h-4 w-4" /> Save & Analyze</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IssueFormDialog;

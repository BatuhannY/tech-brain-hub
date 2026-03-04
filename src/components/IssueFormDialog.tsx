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
  const [solutionSteps, setSolutionSteps] = useState('');
  const [status, setStatus] = useState('Pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setCategory(issue.category);
      setSolutionSteps(issue.solution_steps || '');
      setStatus(issue.status);
    } else {
      setTitle('');
      setDescription('');
      setCategory('Bug');
      setSolutionSteps('');
      setStatus('Pending');
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
          .update({ title, description, category, solution_steps: solutionSteps, status })
          .eq('id', issue.id);
        if (error) throw error;
        toast.success('Issue updated');
      } else {
        const { error } = await supabase
          .from('issue_logs')
          .insert({ title, description, category, solution_steps: solutionSteps, status });
        if (error) throw error;
        toast.success('Issue created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{issue ? 'Edit Issue' : 'Log New Issue'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., VPN not connecting on macOS" />
          </div>
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
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue..." rows={3} />
          </div>
          <div>
            <Label>Solution Steps</Label>
            <RichTextEditor content={solutionSteps} onChange={setSolutionSteps} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : issue ? 'Update Issue' : 'Save Issue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IssueFormDialog;

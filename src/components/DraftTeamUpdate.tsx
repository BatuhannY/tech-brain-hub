import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Megaphone, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface DraftTeamUpdateProps {
  issue: any;
}

const DraftTeamUpdate = ({ issue }: DraftTeamUpdateProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (issue.status !== 'Validated') return null;

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: {
          mode: 'draft-announcement',
          issues: [{
            title: issue.title, category: issue.category,
            description: issue.description, internal_fix: issue.internal_fix,
            ai_suggested_fix: issue.ai_suggested_fix,
          }],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft(data.announcement);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      {!draft ? (
        <Button
          size="sm" variant="outline"
          className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
          onClick={generate} disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
          Draft Team Update
        </Button>
      ) : (
        <Card className="shadow-none border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Team Update Draft</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setDraft(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{draft}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DraftTeamUpdate;

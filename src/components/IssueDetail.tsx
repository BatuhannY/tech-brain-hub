import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Bot, Globe, Wrench, BookOpen } from 'lucide-react';
import RelatedIntelligence from '@/components/RelatedIntelligence';

interface IssueDetailProps {
  issue: any;
  onUpdated: () => void;
}

const IssueDetail = ({ issue, onUpdated }: IssueDetailProps) => {
  const [validating, setValidating] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleValidateFix = async (source: 'ai' | 'web') => {
    setValidating(true);
    try {
      const fixContent = source === 'ai' ? issue.ai_suggested_fix : issue.web_fix;
      const { error } = await supabase
        .from('issue_logs')
        .update({
          internal_fix: fixContent,
          solution_steps: fixContent,
          status: 'Validated',
        } as any)
        .eq('id', issue.id);
      if (error) throw error;
      toast.success('Fix validated and promoted to internal fix!');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to validate');
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

  return (
    <div className="px-4 pb-4 space-y-3">
      {issue.description && (
        <p className="text-sm text-muted-foreground">{issue.description}</p>
      )}

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

      {/* Internal Fix */}
      {issue.internal_fix && (
        <Card className="shadow-none border-[hsl(var(--status-resolved))]/20 bg-[hsl(var(--status-resolved))]/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="h-3.5 w-3.5 text-[hsl(var(--status-resolved))]" />
              <span className="text-xs font-semibold text-[hsl(var(--status-resolved))] uppercase tracking-wide">Internal Fix</span>
            </div>
            <div
              className="prose prose-sm max-w-none text-sm [&_p]:text-foreground [&_li]:text-foreground"
              dangerouslySetInnerHTML={{ __html: issue.internal_fix }}
            />
          </CardContent>
        </Card>
      )}

      {/* AI Suggested Fix */}
      {issue.ai_suggested_fix && (
        <Card className="shadow-none border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI Suggested Fix</span>
              </div>
              {issue.status !== 'Validated' && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Did this work?</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-[hsl(var(--status-resolved))] hover:bg-[hsl(var(--status-resolved))]/10 gap-1"
                    onClick={() => handleValidateFix('ai')}
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
            <p className="text-sm text-foreground whitespace-pre-wrap">{issue.ai_suggested_fix}</p>
          </CardContent>
        </Card>
      )}

      {/* Web Fix */}
      {issue.web_fix && (
        <Card className="shadow-none border-secondary-foreground/10 bg-secondary/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-secondary-foreground" />
                <span className="text-xs font-semibold text-secondary-foreground uppercase tracking-wide">Web Fix</span>
              </div>
              {issue.status !== 'Validated' && !issue.internal_fix && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Did this work?</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-[hsl(var(--status-resolved))] hover:bg-[hsl(var(--status-resolved))]/10 gap-1"
                    onClick={() => handleValidateFix('web')}
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
            <p className="text-sm text-foreground whitespace-pre-wrap">{issue.web_fix}</p>
          </CardContent>
        </Card>
      )}

      {/* Legacy solution_steps fallback */}
      {!issue.internal_fix && !issue.ai_suggested_fix && !issue.web_fix && issue.solution_steps && (
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
    </div>
  );
};

export default IssueDetail;

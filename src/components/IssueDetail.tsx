import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Bot, Globe, Wrench } from 'lucide-react';

interface IssueDetailProps {
  issue: any;
  onUpdated: () => void;
}

const IssueDetail = ({ issue, onUpdated }: IssueDetailProps) => {
  const [validating, setValidating] = useState(false);

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

  return (
    <div className="px-4 pb-4 space-y-3">
      {issue.description && (
        <p className="text-sm text-muted-foreground">{issue.description}</p>
      )}

      {/* Internal Fix */}
      {issue.internal_fix && (
        <Card className="shadow-none border-green-200 bg-green-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Wrench className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Internal Fix</span>
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
        <Card className="shadow-none border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">AI Suggested Fix</span>
              </div>
              {issue.status !== 'Validated' && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Did this work?</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                    onClick={() => handleValidateFix('ai')}
                    disabled={validating}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
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
        <Card className="shadow-none border-purple-200 bg-purple-50/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Web Fix</span>
              </div>
              {issue.status !== 'Validated' && !issue.internal_fix && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Did this work?</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                    onClick={() => handleValidateFix('web')}
                    disabled={validating}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
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

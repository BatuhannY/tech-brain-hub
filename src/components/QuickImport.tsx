import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, ArrowRight, Sparkles, Check, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useAIStatus } from '@/hooks/useAIStatus';

interface ParsedData {
  title: string;
  description: string;
  proposed_fix: string;
  suggested_category: string;
  confidence: number;
}

interface QuickImportProps {
  onApply: (data: { title: string; description: string; fix: string; category: string }) => void;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Authentication': ['login', 'log in', 'sign in', 'signin', 'password', 'auth', 'sso', 'mfa', '2fa', 'credential'],
  'Network': ['network', 'vpn', 'wifi', 'wi-fi', 'dns', 'proxy', 'firewall', 'connection', 'internet'],
  'Email': ['email', 'outlook', 'smtp', 'inbox', 'mail', 'exchange'],
  'Hardware': ['printer', 'monitor', 'keyboard', 'mouse', 'laptop', 'dock', 'usb', 'hardware'],
  'Software': ['install', 'update', 'crash', 'freeze', 'error', 'bug', 'software', 'app', 'application'],
  'Access': ['permission', 'access', 'denied', 'unauthorized', 'role', 'admin'],
  'Performance': ['slow', 'lag', 'performance', 'memory', 'cpu', 'disk', 'storage'],
};

function parseLocally(transcript: string): ParsedData {
  const firstSentence = transcript.split(/[.!?\n]/).filter(s => s.trim())[0]?.trim() || transcript.slice(0, 80);
  const title = firstSentence.length > 100 ? firstSentence.slice(0, 97) + '...' : firstSentence;

  const lower = transcript.toLowerCase();
  let suggested_category = 'General';
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      suggested_category = cat;
      break;
    }
  }

  return { title, description: transcript.trim(), proposed_fix: '', suggested_category, confidence: 60 };
}

const QuickImport = ({ onApply }: QuickImportProps) => {
  const { isAIOffline, checkAIError } = useAIStatus();
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fixApproved, setFixApproved] = useState(false);

  const handleParse = async () => {
    if (!transcript.trim()) { toast.error('Paste a chat transcript first'); return; }
    setParsing(true);
    setParsed(null);
    setFixApproved(false);

    if (isAIOffline) {
      const result = parseLocally(transcript);
      setParsed(result);
      toast.success('Transcript parsed locally (database mode)');
      setParsing(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics', {
        body: { mode: 'parse-chat', chatTranscript: transcript.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        if (checkAIError(data.error)) {
          const result = parseLocally(transcript);
          setParsed(result);
          toast.info('AI offline — parsed locally');
          return;
        }
        throw new Error(data.error);
      }
      setParsed(data);
      toast.success('Chat transcript parsed successfully');
    } catch (err: any) {
      // Fallback to local parsing on any error
      const result = parseLocally(transcript);
      setParsed(result);
      toast.info('AI unavailable — parsed locally');
    } finally {
      setParsing(false);
    }
  };

  const handleApply = () => {
    if (!parsed) return;
    onApply({
      title: parsed.title,
      description: parsed.description,
      fix: fixApproved ? parsed.proposed_fix : '',
      category: parsed.suggested_category,
    });
    setTranscript('');
    setParsed(null);
    setFixApproved(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Quick Import from Chat</span>
      </div>

      <Textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Paste a Slack/Discord chat transcript here…&#10;&#10;e.g. 'Hey, user X can't log in, they keep getting a 500 error. We tried clearing cache but no luck. Might be related to the new deploy...'"
        rows={4}
        className="text-sm resize-none"
      />

      <Button onClick={handleParse} disabled={parsing || !transcript.trim()} size="sm" variant="outline" className="gap-1.5">
        {parsing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing…</> : <><Sparkles className="h-3.5 w-3.5" /> Parse Transcript</>}
      </Button>

      {parsed && (
        <Card className="shadow-none border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Extracted Data</span>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Check className="h-2.5 w-2.5" />
                {parsed.confidence}% confidence
              </Badge>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Title</p>
                <p className="text-sm font-medium text-foreground">{parsed.title}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Description</p>
                <p className="text-sm text-foreground">{parsed.description}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Category</p>
                <Badge variant="secondary" className="text-[10px]">{parsed.suggested_category}</Badge>
              </div>
              {parsed.proposed_fix && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Proposed Fix</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{parsed.proposed_fix}</p>
                  {fixApproved ? (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-[hsl(var(--status-resolved))] font-medium">
                      <Check className="h-3.5 w-3.5" />
                      Fix approved — will be saved as Internal Fix
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1.5 h-7 text-xs border-[hsl(var(--status-resolved))]/30 text-[hsl(var(--status-resolved))] hover:bg-[hsl(var(--status-resolved))]/10"
                      onClick={() => { setFixApproved(true); toast.success('Fix approved — it will be added as Internal Fix on apply'); }}
                    >
                      <Check className="h-3 w-3" />
                      Approve Fix
                    </Button>
                  )}
                </div>
              )}
            </div>

            <Button onClick={handleApply} size="sm" className="w-full gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              Apply to Issue Form
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QuickImport;

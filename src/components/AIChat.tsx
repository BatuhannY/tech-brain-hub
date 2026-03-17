import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Loader2, Bot, User, CheckCircle2, Sparkles, RotateCcw, Database } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useAIStatus } from '@/hooks/useAIStatus';

type Message = { role: 'user' | 'assistant'; content: string };

interface AIChatProps {
  onIssueCreated?: () => void;
}

// Local DB-based response when AI is offline
async function getDBResponse(userMsg: string): Promise<string> {
  const { data: issues } = await supabase
    .from('issue_logs')
    .select('*')
    .order('report_count', { ascending: false })
    .limit(100);

  if (!issues?.length) return "No issues in the database yet. Add issues to get started.";

  const lower = userMsg.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  const scored = issues.map(issue => {
    const text = `${issue.title} ${issue.description || ''} ${issue.category} ${issue.internal_fix || ''} ${issue.ai_suggested_fix || ''}`.toLowerCase();
    let score = 0;
    words.forEach(w => { if (text.includes(w)) score += 1; });
    if (issue.title.toLowerCase().includes(lower)) score += 3;
    return { issue, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  if (scored.length === 0) {
    return `No matching issues found in the database for "${userMsg}".\n\nThere are **${issues.length}** issues in the knowledge base. Try different keywords or browse the Issues tab.`;
  }

  let response = `🔍 **Database Search Results** *(AI offline — showing matches from knowledge base)*\n\nFound **${scored.length}** relevant issue(s):\n\n`;

  scored.forEach(({ issue }, i) => {
    response += `---\n\n### ${i + 1}. ${issue.title}\n\n`;
    response += `**Category:** ${issue.category} | **Status:** ${issue.status}`;
    if (issue.report_count > 1) response += ` | **Reports:** ${issue.report_count}`;
    response += '\n\n';
    if (issue.description) response += `${issue.description}\n\n`;

    const fix = issue.internal_fix || issue.solution_steps || issue.ai_suggested_fix || issue.web_fix;
    if (fix) {
      response += `> ✅ **Known Fix:**\n>\n> ${fix.replace(/\n/g, '\n> ')}\n\n`;
    }
  });

  return response;
}

const AIChat = ({ onIssueCreated }: AIChatProps) => {
  const { isAIOffline, checkAIError } = useAIStatus();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addAsIssue, setAddAsIssue] = useState(false);
  const [lastIssueAdded, setLastIssueAdded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setLoading(true);
    setLastIssueAdded(false);

    // If AI is offline, use DB fallback
    if (isAIOffline) {
      try {
        const reply = await getDBResponse(text);
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to search the database.' }]);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: allMessages, addAsIssue },
      });
      if (error) throw error;
      if (data?.error) {
        if (checkAIError(data.error)) {
          // Fallback to DB
          const reply = await getDBResponse(text);
          setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
          toast.info('AI offline — switched to database mode');
          return;
        }
        throw new Error(data.error);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.issueCreated) {
        setLastIssueAdded(true);
        toast.success('Issue added to the database!');
        onIssueCreated?.();
      }
    } catch (err: any) {
      // Try DB fallback on any error
      try {
        const reply = await getDBResponse(text);
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } catch {
        toast.error(err.message || 'AI request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setLastIssueAdded(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {isAIOffline ? <Database className="h-8 w-8 text-primary" /> : <Sparkles className="h-8 w-8 text-primary" />}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {isAIOffline ? 'Knowledge Base Search' : 'AI Issue Analyst'}
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
                {isAIOffline
                  ? 'AI is currently offline. Describe an issue and I\'ll search the knowledge base for matching solutions.'
                  : 'Describe a tech issue and I\'ll analyze it, suggest fixes from our knowledge base, and help categorize it for future reference.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 max-w-md justify-center">
              {['VPN not connecting', 'Outlook keeps crashing', 'Can\'t access shared drive'].map(hint => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted/50 border border-border rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-sm [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_code]:text-foreground [&_code]:bg-secondary [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:mt-3 [&_h3]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-green-500 [&_blockquote]:bg-green-50 [&_blockquote]:dark:bg-green-950/30 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:my-3 [&_blockquote]:rounded-r-lg [&_blockquote_p]:text-green-800 [&_blockquote_p]:dark:text-green-300">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-muted/50 border border-border px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            {lastIssueAdded && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 pl-9">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Issue saved to database
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border pt-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isAIOffline && (
              <>
                <Checkbox
                  id="addIssue"
                  checked={addAsIssue}
                  onCheckedChange={(v) => setAddAsIssue(!!v)}
                />
                <label htmlFor="addIssue" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Add as a new issue
                </label>
              </>
            )}
            {isAIOffline && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Database className="h-3 w-3" /> Database mode
              </span>
            )}
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1" onClick={handleClear}>
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isAIOffline ? "Search the knowledge base..." : "Describe a tech issue..."}
            className="min-h-[44px] max-h-32 resize-none text-sm rounded-xl"
            rows={1}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="shrink-0 h-11 w-11 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

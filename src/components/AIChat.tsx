import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Loader2, Bot, User, CheckCircle2, Sparkles, RotateCcw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; content: string };

interface AIChatProps {
  onIssueCreated?: () => void;
  isAdmin?: boolean;
}

const AIChat = ({ onIssueCreated, isAdmin = false }: AIChatProps) => {
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

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: allMessages, addAsIssue: isAdmin && addAsIssue, isAdmin },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('Rate limited. Please wait and try again.');
        } else if (data.error.includes('Payment')) {
          toast.error('AI credits exhausted. Please add credits.');
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.issueCreated) {
        setLastIssueAdded(true);
        toast.success('Issue added to the database!');
        onIssueCreated?.();
      }
      if (data.commandExecuted) {
        toast.success('Command executed successfully!');
        onIssueCreated?.(); // refresh issue list
      }
    } catch (err: any) {
      toast.error(err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setLastIssueAdded(false);
  };

  const adminHints = ['Show analytics summary', 'What needs attention?', 'Resolve issue...', 'Recommend fix for unresolved issues'];
  const publicHints = ['VPN not connecting', 'Outlook keeps crashing', "Can't access shared drive"];
  const hints = isAdmin ? adminHints : publicHints;

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <p className="text-base font-semibold text-foreground">AI Issue Analyst</p>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
                {isAdmin
                  ? 'Analyze issues, run management commands, get analytics, and receive fix recommendations for unresolved problems.'
                  : 'Describe a tech issue and I\'ll analyze it, suggest fixes from our knowledge base, and help categorize it for future reference.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 max-w-md justify-center">
              {hints.map(hint => (
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
            {isAdmin && (
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
            placeholder={isAdmin ? "Ask about issues, run commands, or get analytics..." : "Describe a tech issue..."}
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

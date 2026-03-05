import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Bot, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; content: string };

const AIChat = () => {
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
        body: { messages: allMessages, addAsIssue },
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
      }
    } catch (err: any) {
      toast.error(err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-foreground">AI Issue Analyst</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Describe a tech issue and I'll analyze it, suggest a category, provide fixes, and help expand your knowledge base.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <Card className={`max-w-[80%] px-3.5 py-2.5 shadow-none ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground border-0'
                : 'bg-card border-border'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none text-sm [&_p]:text-foreground [&_li]:text-foreground [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_code]:text-foreground [&_code]:bg-secondary">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </Card>
            {msg.role === 'user' && (
              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <Card className="px-3.5 py-2.5 shadow-none bg-card border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </Card>
          </div>
        )}
        {lastIssueAdded && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 pl-9">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Issue saved to database
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border pt-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id="addIssue"
            checked={addAsIssue}
            onCheckedChange={(v) => setAddAsIssue(!!v)}
          />
          <label htmlFor="addIssue" className="text-xs text-muted-foreground cursor-pointer select-none">
            Add as a new issue
          </label>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Describe a tech issue..."
            className="min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="shrink-0 h-11 w-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

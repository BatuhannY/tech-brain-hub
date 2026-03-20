import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Hash, ChevronDown, Send, AtSign, Smile, Paperclip, Plus, Search, Bell, MessageSquare, MoreHorizontal, Home, BookOpen, Headphones, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

type SlackMessage = {
  id: string;
  user: string;
  avatar: string;
  isBot: boolean;
  content: string;
  time: string;
};

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

async function searchKnowledgeBase(query: string): Promise<string> {
  const { data: issues } = await supabase
    .from('issue_logs')
    .select('*')
    .order('report_count', { ascending: false })
    .limit(100);

  if (!issues?.length) return "I couldn't find any issues in the knowledge base yet. The team hasn't logged any entries.";

  const lower = query.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  const scored = issues.map(issue => {
    const text = `${issue.title} ${issue.description || ''} ${issue.category} ${stripHtml(issue.internal_fix || '')} ${issue.ai_suggested_fix || ''}`.toLowerCase();
    let score = 0;
    words.forEach(w => { if (text.includes(w)) score += 1; });
    if (issue.title.toLowerCase().includes(lower)) score += 3;
    if (issue.status === 'Resolved') score += 1;
    return { issue, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  if (scored.length === 0) {
    return `I searched the knowledge base for _"${query}"_ but couldn't find a match. Try different keywords or check with the support team directly.`;
  }

  let response = `Found *${scored.length}* result(s) from the knowledge base:\n\n`;

  scored.forEach(({ issue }, i) => {
    const statusEmoji = issue.status === 'Resolved' ? '✅' : '🔶';
    response += `**${i + 1}. ${issue.title}**\n`;
    response += `${statusEmoji} ${issue.status} · ${issue.category}`;
    if (issue.report_count > 1) response += ` · ${issue.report_count} reports`;
    response += '\n\n';

    const fix = stripHtml(issue.internal_fix || '') || issue.solution_steps || issue.ai_suggested_fix || issue.web_fix;
    if (fix) {
      response += `**Fix:** ${fix}\n\n`;
    }
    if (issue.description) {
      response += `_${issue.description}_\n\n`;
    }
    if (i < scored.length - 1) response += '---\n\n';
  });

  return response;
}

const now = () => {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const CHANNELS = [
  { name: 'it-helpdesk', active: true },
  { name: 'general', active: false },
  { name: 'engineering', active: false },
  { name: 'product-updates', active: false },
  { name: 'random', active: false },
];

const DMS = [
  { name: 'Knowledge Hub Bot', online: true, isBot: true },
  { name: 'Sarah Chen', online: true },
  { name: 'Mike Johnson', online: false },
];

const SlackSimulator = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SlackMessage[]>([
    {
      id: '1',
      user: 'Knowledge Hub Bot',
      avatar: '🤖',
      isBot: true,
      content: "👋 Hey there! I'm the **Knowledge Hub Bot**. Ask me anything about known issues and I'll search our knowledge base for solutions.\n\nTry something like _\"VPN not connecting\"_ or _\"Outlook keeps crashing\"_.",
      time: now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: SlackMessage = {
      id: Date.now().toString(),
      user: 'You',
      avatar: '👤',
      isBot: false,
      content: text,
      time: now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate realistic delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    try {
      const reply = await searchKnowledgeBase(text);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          user: 'Knowledge Hub Bot',
          avatar: '🤖',
          isBot: true,
          content: reply,
          time: now(),
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          user: 'Knowledge Hub Bot',
          avatar: '🤖',
          isBot: true,
          content: "⚠️ Something went wrong searching the knowledge base. Please try again.",
          time: now(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="h-screen w-full flex bg-[#1a1d21] text-[#d1d2d3] font-['Lato',sans-serif] text-[15px] overflow-hidden">
      {/* Workspace sidebar (narrow) */}
      <div className="w-[68px] bg-[#1a1d21] border-r border-[#35373b] flex flex-col items-center py-3 gap-4 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#4a154b] flex items-center justify-center text-white font-bold text-sm">
          KH
        </div>
        <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
          <Home className="h-[18px] w-[18px]" />
        </div>
        <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
          <MessageSquare className="h-[18px] w-[18px]" />
        </div>
        <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
          <BookOpen className="h-[18px] w-[18px]" />
        </div>
        <div className="mt-auto w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
          <Headphones className="h-[18px] w-[18px]" />
        </div>
      </div>

      {/* Channel sidebar */}
      <div className="w-[260px] bg-[#1a1d21] border-r border-[#35373b] flex flex-col shrink-0">
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#35373b]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-[17px]">Knowledge Hub</span>
            <ChevronDown className="h-4 w-4 text-[#ababad]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-4 mb-1">
            <span className="text-xs font-semibold text-[#ababad] uppercase tracking-wide">Channels</span>
          </div>
          {CHANNELS.map(ch => (
            <div
              key={ch.name}
              className={`flex items-center gap-2 px-4 py-[5px] cursor-pointer text-sm transition-colors ${
                ch.active ? 'bg-[#1164a3] text-white rounded-md mx-2 px-2' : 'text-[#ababad] hover:bg-[#27242c]'
              }`}
            >
              <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span>{ch.name}</span>
            </div>
          ))}

          <div className="px-4 mt-5 mb-1">
            <span className="text-xs font-semibold text-[#ababad] uppercase tracking-wide">Direct Messages</span>
          </div>
          {DMS.map(dm => (
            <div
              key={dm.name}
              className="flex items-center gap-2 px-4 py-[5px] cursor-pointer text-sm text-[#ababad] hover:bg-[#27242c] transition-colors"
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${dm.online ? 'bg-[#2bac76]' : 'border border-[#ababad]'}`} />
              <span className="truncate">{dm.name}</span>
              {dm.isBot && <span className="text-[10px] bg-[#35373b] text-[#ababad] px-1.5 py-0.5 rounded font-medium">BOT</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-[#1a1d21] min-w-0">
        {/* Channel header */}
        <div className="h-[49px] border-b border-[#35373b] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#ababad] hover:text-white hover:bg-[#35373b] gap-1.5 h-7 px-2"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Button>
            <div className="w-px h-4 bg-[#35373b]" />
            <Hash className="h-4 w-4 text-[#ababad]" />
            <span className="font-bold text-white text-[15px]">it-helpdesk</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
              <Search className="h-4 w-4" />
            </div>
            <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
              <Bell className="h-4 w-4" />
            </div>
            <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="max-w-[900px]">
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-2.5 py-2 hover:bg-[#222529] -mx-5 px-5 transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-lg shrink-0 mt-0.5">
                  {msg.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold text-[15px] ${msg.isBot ? 'text-white' : 'text-white'}`}>
                      {msg.user}
                    </span>
                    {msg.isBot && (
                      <span className="text-[10px] bg-[#35373b] text-[#ababad] px-1.5 py-0.5 rounded font-medium leading-none">APP</span>
                    )}
                    <span className="text-xs text-[#ababad]">{msg.time}</span>
                  </div>
                  <div className="mt-0.5 text-[#d1d2d3] text-[15px] leading-[1.46] slack-prose">
                    <ReactMarkdown
                      components={{
                        strong: ({ children }) => <span className="font-bold text-white">{children}</span>,
                        em: ({ children }) => <span className="italic text-[#d1d2d3]">{children}</span>,
                        hr: () => <div className="border-t border-[#35373b] my-3" />,
                        p: ({ children }) => <p className="my-1">{children}</p>,
                        code: ({ children }) => (
                          <code className="bg-[#2d2f34] text-[#e8912d] px-1 py-0.5 rounded text-[13px] font-mono">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2.5 py-2 -mx-5 px-5">
                <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-lg shrink-0 mt-0.5">
                  🤖
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-[15px] text-white">Knowledge Hub Bot</span>
                    <span className="text-[10px] bg-[#35373b] text-[#ababad] px-1.5 py-0.5 rounded font-medium leading-none">APP</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#ababad] animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-[#ababad] animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-[#ababad] animate-bounce [animation-delay:300ms]" />
                    <span className="text-xs text-[#ababad] ml-1.5">is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="px-5 pb-4 shrink-0">
          <div className="border border-[#565856] rounded-lg bg-[#222529] overflow-hidden focus-within:border-[#868686] transition-colors">
            <div className="flex items-center">
              <div className="flex items-center gap-0.5 px-2 border-r border-[#35373b]">
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message #it-helpdesk"
                className="flex-1 bg-transparent text-[#d1d2d3] px-3 py-2.5 text-[15px] placeholder:text-[#ababad] focus:outline-none"
                disabled={typing}
              />
              <div className="flex items-center gap-0.5 px-2">
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
                  <AtSign className="h-4 w-4" />
                </div>
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
                  <Paperclip className="h-4 w-4" />
                </div>
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors">
                  <Smile className="h-4 w-4" />
                </div>
                <button
                  onClick={handleSend}
                  disabled={typing || !input.trim()}
                  className={`h-7 w-7 rounded flex items-center justify-center transition-colors ml-1 ${
                    input.trim() && !typing
                      ? 'bg-[#007a5a] text-white hover:bg-[#148567]'
                      : 'text-[#ababad] cursor-not-allowed'
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#ababad] mt-1.5 text-center">
            This is a simulator. Messages are powered by your Knowledge Hub database.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SlackSimulator;

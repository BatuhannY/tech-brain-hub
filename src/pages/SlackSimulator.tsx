import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Hash, ChevronDown, Send, AtSign, Smile, Paperclip, Plus, Search, Bell, MessageSquare, MoreHorizontal, Home, BookOpen, Headphones, ArrowLeft, AlertTriangle, X, ChevronRight, ChevronLeft as ChevronLeftIcon, Clock, CheckCircle2, ExternalLink, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

// ─── Types ───

type SlackMessage = {
  id: string;
  user: string;
  avatar: string;
  isBot: boolean;
  content: string;
  time: string;
  isThread?: boolean;
  threadId?: string;
  blocks?: BlockMessage | null;
  actionButtons?: boolean;
  slaDeadline?: number;
  resolved?: boolean;
  handoff?: boolean;
  matchScore?: number;
};

type BlockMessage = {
  title: string;
  description: string;
  stepsToReproduce: string;
  tool: string;
  impact: string;
  markets: string[];
  dateTime: string;
  hsLink: string;
  actionsTaken: string;
};

type WizardData = {
  title: string;
  description: string;
  stepsToReproduce: string;
  tool: string;
  impact: string;
  markets: string[];
  dateTime: string;
  hsLink: string;
  actionsTaken: string;
};

// ─── Helpers ───

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function scoreIssue(issue: any, query: string): { score: number; maxScore: number } {
  const lower = query.toLowerCase().trim();
  const titleLower = issue.title.toLowerCase();

  // Exact title match → 99% confidence
  if (titleLower === lower || titleLower.includes(lower) || lower.includes(titleLower)) {
    return { score: 99, maxScore: 100 };
  }

  const words = lower.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return { score: 0, maxScore: 1 };

  const text = `${issue.title} ${issue.description || ''} ${issue.category} ${stripHtml(issue.internal_fix || '')} ${issue.ai_suggested_fix || ''} ${issue.solution_steps || ''}`.toLowerCase();
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);

  // Count how many query words appear in the issue text
  const matchedWords = words.filter(w => text.includes(w)).length;
  const wordMatchRatio = matchedWords / words.length; // 0-1

  // Count how many query words appear specifically in the title
  const titleMatchedWords = words.filter(w => titleWords.some((tw: string) => tw.includes(w) || w.includes(tw))).length;
  const titleMatchRatio = titleMatchedWords / words.length; // 0-1

  // Weighted score: 40% word match + 50% title match + 10% resolved bonus
  const score = (wordMatchRatio * 40) + (titleMatchRatio * 50) + (issue.status === 'Resolved' ? 10 : 0);
  return { score, maxScore: 100 };
}

async function strictSearch(query: string): Promise<{ issue: any | null; confidence: number; response: string }> {
  const { data: issues } = await supabase
    .from('issue_logs')
    .select('*')
    .order('report_count', { ascending: false })
    .limit(100);

  if (!issues?.length) {
    return { issue: null, confidence: 0, response: "No issues found in the knowledge base." };
  }

  const scored = issues.map(issue => {
    const { score, maxScore } = scoreIssue(issue, query);
    const confidence = maxScore > 0 ? Math.min(Math.round((score / maxScore) * 100), 99) : 0;
    return { issue, score, confidence };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { issue: null, confidence: 0, response: `No matching results for "${query}".` };
  }

  const best = scored[0];
  const fix = stripHtml(best.issue.internal_fix || '') || best.issue.solution_steps || best.issue.ai_suggested_fix || best.issue.web_fix || '';
  const statusEmoji = best.issue.status === 'Resolved' ? '✅' : '🔶';

  let response = `**${best.issue.title}**\n${statusEmoji} ${best.issue.status} · ${best.issue.category}`;
  if (best.issue.report_count > 1) response += ` · ${best.issue.report_count} reports`;
  response += '\n\n';
  if (fix) response += `**Recommended Fix:**\n${fix}\n\n`;
  if (best.issue.description) response += `_${best.issue.description}_\n\n`;

  if (best.confidence < 80) {
    response += `\n⚠️ _I couldn't find an exact match in the Knowledge Hub, so I am alerting a human expert._`;
  }

  return { issue: best.issue, confidence: best.confidence, response };
}

const now = () => {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const SLA_MAP: Record<string, number> = {
  'Blocker': 60 * 60 * 1000,   // 1h
  'High': 4 * 60 * 60 * 1000,  // 4h
  'Medium': 8 * 60 * 60 * 1000, // 8h
  'Low': 24 * 60 * 60 * 1000,  // 24h
};

const TOOLS = ['Salesforce', 'Outlook', 'VPN / Network', 'SAP', 'Jira', 'Slack', 'Zoom', 'Internal Portal', 'Other'];
const MARKETS = ['North America', 'EMEA', 'APAC', 'LATAM', 'Global'];

// ─── SLA Timer Component ───

const SLATimer = ({ deadline, resolved }: { deadline: number; resolved?: boolean }) => {
  const [remaining, setRemaining] = useState(deadline - Date.now());

  useEffect(() => {
    if (resolved) return;
    const interval = setInterval(() => setRemaining(deadline - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline, resolved]);

  if (resolved) return <span className="text-[#2bac76] text-xs font-medium">✅ Resolved</span>;

  const isExpired = remaining <= 0;
  const hours = Math.floor(Math.abs(remaining) / 3600000);
  const mins = Math.floor((Math.abs(remaining) % 3600000) / 60000);
  const secs = Math.floor((Math.abs(remaining) % 60000) / 1000);

  return (
    <span className={`text-xs font-mono font-medium ${isExpired ? 'text-[#e01e5a]' : remaining < 900000 ? 'text-[#ecb22e]' : 'text-[#2bac76]'}`}>
      <Clock className="h-3 w-3 inline mr-1" />
      {isExpired ? '-' : ''}{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      {isExpired && ' BREACHED'}
    </span>
  );
};

// ─── Confidence Badge ───

const ConfidenceBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? 'bg-[#2bac76]' : score >= 60 ? 'bg-[#ecb22e]' : 'bg-[#e01e5a]';
  return (
    <span className={`${color} text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-2`}>
      {score}% Match
    </span>
  );
};

// ─── Report Issue Wizard ───

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

const WizardModal = ({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (data: WizardData) => void }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    title: '', description: '', stepsToReproduce: '',
    tool: '', impact: 'Medium', markets: [],
    dateTime: new Date().toISOString().slice(0, 16), hsLink: '', actionsTaken: '',
  });

  if (!open) return null;

  const update = (field: keyof WizardData, value: any) => setData(prev => ({ ...prev, [field]: value }));

  const toggleMarket = (m: string) => {
    setData(prev => ({
      ...prev,
      markets: prev.markets.includes(m) ? prev.markets.filter(x => x !== m) : [...prev.markets, m],
    }));
  };

  const canNext = step === 1 ? data.title.trim() && data.description.trim() : step === 2 ? data.tool : true;

  const handleSubmit = () => {
    onSubmit(data);
    onClose();
    setStep(1);
    setData({ title: '', description: '', stepsToReproduce: '', tool: '', impact: 'Medium', markets: [], dateTime: new Date().toISOString().slice(0, 16), hsLink: '', actionsTaken: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-[560px] bg-white rounded-lg shadow-2xl text-[#1d1c1d] font-['Lato',sans-serif] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e8e8]">
          <div>
            <h2 className="text-lg font-bold text-[#1d1c1d]">Report an Issue</h2>
            <p className="text-[13px] text-[#616061]">Step {step} of 3 — {step === 1 ? 'The What' : step === 2 ? 'The Context' : 'The Logistics'}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded hover:bg-[#f0f0f0] flex items-center justify-center text-[#616061]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#e8e8e8]">
          <div className="h-full bg-[#007a5a] transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[400px] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Issue Title <span className="text-[#e01e5a]">*</span></label>
                <input
                  type="text" value={data.title} onChange={e => update('title', e.target.value)}
                  placeholder="e.g., VPN disconnects every 30 minutes"
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] placeholder:text-[#868686] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Description <span className="text-[#e01e5a]">*</span></label>
                <textarea
                  value={data.description} onChange={e => update('description', e.target.value)}
                  placeholder="Describe the issue in detail..."
                  rows={3}
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] placeholder:text-[#868686] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] resize-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Steps to Reproduce</label>
                <textarea
                  value={data.stepsToReproduce} onChange={e => update('stepsToReproduce', e.target.value)}
                  placeholder="1. Open the app&#10;2. Click on...&#10;3. Error appears"
                  rows={3}
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] placeholder:text-[#868686] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] resize-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Which Tool <span className="text-[#e01e5a]">*</span></label>
                <select
                  value={data.tool} onChange={e => update('tool', e.target.value)}
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] bg-white"
                >
                  <option value="">Select a tool...</option>
                  {TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-2">Impact Level</label>
                <div className="flex flex-col gap-2">
                  {['Low', 'Medium', 'High', 'Blocker'].map(level => (
                    <label key={level} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${data.impact === level ? 'border-[#007a5a] bg-[#f0faf6]' : 'border-[#e8e8e8] hover:bg-[#f8f8f8]'}`}>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${data.impact === level ? 'border-[#007a5a]' : 'border-[#ccc]'}`}>
                        {data.impact === level && <div className="h-2 w-2 rounded-full bg-[#007a5a]" />}
                      </div>
                      <span className="text-sm text-[#1d1c1d] font-medium">{level}</span>
                      <span className="text-xs text-[#616061] ml-auto">
                        {level === 'Low' && 'SLA: 24h'}
                        {level === 'Medium' && 'SLA: 8h'}
                        {level === 'High' && 'SLA: 4h'}
                        {level === 'Blocker' && 'SLA: 1h'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-2">Affected Markets</label>
                <div className="flex flex-wrap gap-2">
                  {MARKETS.map(m => (
                    <button
                      key={m} onClick={() => toggleMarket(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${data.markets.includes(m) ? 'bg-[#007a5a] text-white border-[#007a5a]' : 'bg-white text-[#616061] border-[#ccc] hover:border-[#007a5a]'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Date & Time of Occurrence</label>
                <input
                  type="datetime-local" value={data.dateTime} onChange={e => update('dateTime', e.target.value)}
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Helpscout / Ticket Link</label>
                <input
                  type="url" value={data.hsLink} onChange={e => update('hsLink', e.target.value)}
                  placeholder="https://helpscout.net/ticket/..."
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] placeholder:text-[#868686] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#1d1c1d] mb-1.5">Actions Taken So Far</label>
                <textarea
                  value={data.actionsTaken} onChange={e => update('actionsTaken', e.target.value)}
                  placeholder="List what troubleshooting steps you've already tried..."
                  rows={3}
                  className="w-full border border-[#ccc] rounded px-3 py-2 text-sm text-[#1d1c1d] placeholder:text-[#868686] focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e8e8e8] bg-[#f8f8f8]">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s <= step ? 'bg-[#007a5a]' : 'bg-[#ccc]'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-sm font-medium text-[#616061] hover:text-[#1d1c1d] rounded border border-[#ccc] hover:bg-[#f0f0f0] transition-colors flex items-center gap-1">
                <ChevronLeftIcon className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)} disabled={!canNext}
                className={`px-4 py-2 text-sm font-bold rounded flex items-center gap-1 transition-colors ${canNext ? 'bg-[#007a5a] text-white hover:bg-[#006b4f]' : 'bg-[#ccc] text-white cursor-not-allowed'}`}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={handleSubmit} className="px-5 py-2 text-sm font-bold rounded bg-[#007a5a] text-white hover:bg-[#006b4f] transition-colors">
                Submit Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───

const SlackSimulator = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SlackMessage[]>([
    {
      id: '1',
      user: 'Knowledge Hub Bot',
      avatar: '🤖',
      isBot: true,
      content: "👋 Hey there! I'm the **Knowledge Hub Bot**. Ask me anything about known issues and I'll search our knowledge base for solutions.\n\nTry something like _\"VPN not connecting\"_ or use the **Report Issue** button to file a structured report.",
      time: now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  // Handle free-text search (existing behavior but strict top-1)
  const handleSend = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: SlackMessage = {
      id: Date.now().toString(), user: 'You', avatar: '👤', isBot: false, content: text, time: now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    try {
      const { response, confidence } = await strictSearch(text);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), user: 'Knowledge Hub Bot', avatar: '🤖', isBot: true,
        content: response, time: now(), matchScore: confidence,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), user: 'Knowledge Hub Bot', avatar: '🤖', isBot: true,
        content: "⚠️ Something went wrong searching the knowledge base. Please try again.", time: now(),
      }]);
    } finally {
      setTyping(false);
    }
  };

  // Handle wizard submission
  const handleWizardSubmit = async (data: WizardData) => {
    const threadId = `thread-${Date.now()}`;
    const slaMs = SLA_MAP[data.impact] || SLA_MAP['Medium'];
    const slaDeadline = Date.now() + slaMs;

    // Post user's report as a block message
    const reportMsg: SlackMessage = {
      id: threadId,
      user: 'You',
      avatar: '👤',
      isBot: false,
      content: '',
      time: now(),
      blocks: data,
      threadId,
      slaDeadline,
    };
    setMessages(prev => [...prev, reportMsg]);
    setTyping(true);

    // Simulate 2-second delay for bot reply
    await new Promise(r => setTimeout(r, 2000));

    try {
      const query = `${data.title} ${data.description} ${data.tool}`;
      const { response, confidence } = await strictSearch(query);
      const needsHandoff = confidence < 80;

      const botReply: SlackMessage = {
        id: `${threadId}-reply`,
        user: 'Knowledge Hub Bot',
        avatar: '🤖',
        isBot: true,
        content: response,
        time: now(),
        threadId,
        isThread: true,
        actionButtons: true,
        slaDeadline,
        matchScore: confidence,
        handoff: needsHandoff,
      };
      setMessages(prev => [...prev, botReply]);

      // Auto-handoff if low confidence
      if (needsHandoff) {
        await new Promise(r => setTimeout(r, 800));
        setMessages(prev => [...prev, {
          id: `${threadId}-handoff`,
          user: 'Knowledge Hub Bot',
          avatar: '🤖',
          isBot: true,
          content: '🚨 **Handoff Requested** — Confidence below threshold. @Support-Leads has been notified and will join this thread shortly.',
          time: now(),
          threadId,
          isThread: true,
          handoff: true,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `${threadId}-reply`,
        user: 'Knowledge Hub Bot',
        avatar: '🤖',
        isBot: true,
        content: '⚠️ Something went wrong. Escalating to @Support-Leads.',
        time: now(),
        threadId,
        isThread: true,
        handoff: true,
      }]);
    } finally {
      setTyping(false);
    }
  };

  const handleResolve = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, resolved: true } : m));
    // Add resolution message
    const threadId = messages.find(m => m.id === msgId)?.threadId;
    setMessages(prev => [...prev, {
      id: `${msgId}-resolved`,
      user: 'Knowledge Hub Bot',
      avatar: '🤖',
      isBot: true,
      content: '🎉 **Issue Resolved.** Estimated **15 minutes** of manual research saved.\n\n_This resolution has been logged to improve future matches._',
      time: now(),
      threadId,
      isThread: true,
    }]);
  };

  const handleHandoff = (msgId: string) => {
    const threadId = messages.find(m => m.id === msgId)?.threadId;
    setMessages(prev => [...prev, {
      id: `${msgId}-human`,
      user: 'Knowledge Hub Bot',
      avatar: '🤖',
      isBot: true,
      content: '🙋 **Handoff Requested** — @Support-Leads has been tagged. A human expert will review this thread.\n\n_Thread status changed to: Pending Human Review_',
      time: now(),
      threadId,
      isThread: true,
      handoff: true,
    }]);
  };

  const handleJira = (msgId: string) => {
    const threadId = messages.find(m => m.id === msgId)?.threadId;
    setMessages(prev => [...prev, {
      id: `${msgId}-jira`,
      user: 'Knowledge Hub Bot',
      avatar: '🤖',
      isBot: true,
      content: '🎫 **Jira Ticket Created** — `SUPPORT-' + Math.floor(1000 + Math.random() * 9000) + '`\n\n_Ticket has been linked to this thread for tracking._',
      time: now(),
      threadId,
      isThread: true,
    }]);
  };

  // ─── Render ───

  return (
    <div className="h-screen w-full flex bg-[#1a1d21] text-[#d1d2d3] font-['Lato',sans-serif] text-[15px] overflow-hidden">
      {/* Workspace sidebar (narrow) */}
      <div className="w-[68px] bg-[#1a1d21] border-r border-[#35373b] flex flex-col items-center py-3 gap-4 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[#4a154b] flex items-center justify-center text-white font-bold text-sm">KH</div>
        <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Home className="h-[18px] w-[18px]" /></div>
        <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><MessageSquare className="h-[18px] w-[18px]" /></div>
        <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><BookOpen className="h-[18px] w-[18px]" /></div>
        <div className="mt-auto w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Headphones className="h-[18px] w-[18px]" /></div>
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
          <div className="px-4 mb-1"><span className="text-xs font-semibold text-[#ababad] uppercase tracking-wide">Channels</span></div>
          {CHANNELS.map(ch => (
            <div key={ch.name} className={`flex items-center gap-2 px-4 py-[5px] cursor-pointer text-sm transition-colors ${ch.active ? 'bg-[#1164a3] text-white rounded-md mx-2 px-2' : 'text-[#ababad] hover:bg-[#27242c]'}`}>
              <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" /><span>{ch.name}</span>
            </div>
          ))}
          <div className="px-4 mt-5 mb-1"><span className="text-xs font-semibold text-[#ababad] uppercase tracking-wide">Direct Messages</span></div>
          {DMS.map(dm => (
            <div key={dm.name} className="flex items-center gap-2 px-4 py-[5px] cursor-pointer text-sm text-[#ababad] hover:bg-[#27242c] transition-colors">
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
            <Button variant="ghost" size="sm" className="text-[#ababad] hover:text-white hover:bg-[#35373b] gap-1.5 h-7 px-2" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-3.5 w-3.5" />Dashboard
            </Button>
            <div className="w-px h-4 bg-[#35373b]" />
            <Hash className="h-4 w-4 text-[#ababad]" />
            <span className="font-bold text-white text-[15px]">it-helpdesk</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Search className="h-4 w-4" /></div>
            <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Bell className="h-4 w-4" /></div>
            <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><MoreHorizontal className="h-4 w-4" /></div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="max-w-[900px]">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 py-2 hover:bg-[#222529] -mx-5 px-5 transition-colors group ${msg.isThread ? 'ml-8 border-l-2 border-[#35373b] pl-4' : ''}`}>
                <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-lg shrink-0 mt-0.5">{msg.avatar}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[15px] text-white">{msg.user}</span>
                    {msg.isBot && <span className="text-[10px] bg-[#35373b] text-[#ababad] px-1.5 py-0.5 rounded font-medium leading-none">APP</span>}
                    <span className="text-xs text-[#ababad]">{msg.time}</span>
                    {msg.matchScore !== undefined && msg.matchScore > 0 && <ConfidenceBadge score={msg.matchScore} />}
                    {msg.slaDeadline && !msg.isThread && (
                      <span className="ml-auto"><SLATimer deadline={msg.slaDeadline} resolved={msg.resolved} /></span>
                    )}
                  </div>

                  {/* Block message (wizard report) */}
                  {msg.blocks ? (
                    <div className="mt-2 border-l-4 border-[#007a5a] bg-[#222529] rounded-r-md p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#ecb22e]" />
                        <span className="font-bold text-white text-sm">Issue Report</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${msg.blocks.impact === 'Blocker' ? 'bg-[#e01e5a] text-white' : msg.blocks.impact === 'High' ? 'bg-[#ecb22e] text-[#1d1c1d]' : msg.blocks.impact === 'Medium' ? 'bg-[#36c5f0] text-[#1d1c1d]' : 'bg-[#2bac76] text-white'}`}>
                          {msg.blocks.impact}
                        </span>
                        {msg.slaDeadline && <span className="ml-auto"><SLATimer deadline={msg.slaDeadline} resolved={msg.resolved} /></span>}
                      </div>
                      <div className="text-white font-semibold">{msg.blocks.title}</div>
                      <div className="text-[#d1d2d3] text-sm">{msg.blocks.description}</div>
                      {msg.blocks.stepsToReproduce && (
                        <div className="text-sm"><span className="text-[#ababad]">Steps to Reproduce:</span><pre className="text-[#d1d2d3] mt-1 text-xs bg-[#1a1d21] rounded p-2 whitespace-pre-wrap">{msg.blocks.stepsToReproduce}</pre></div>
                      )}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#ababad] pt-1">
                        <span>🛠 {msg.blocks.tool}</span>
                        {msg.blocks.markets.length > 0 && <span>🌍 {msg.blocks.markets.join(', ')}</span>}
                        {msg.blocks.hsLink && <a href={msg.blocks.hsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#36c5f0] hover:underline"><ExternalLink className="h-3 w-3" />Ticket</a>}
                        {msg.blocks.actionsTaken && <span>📝 Prior actions documented</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[#d1d2d3] text-[15px] leading-[1.46] slack-prose">
                      <ReactMarkdown
                        components={{
                          strong: ({ children }) => <span className="font-bold text-white">{children}</span>,
                          em: ({ children }) => <span className="italic text-[#d1d2d3]">{children}</span>,
                          hr: () => <div className="border-t border-[#35373b] my-3" />,
                          p: ({ children }) => <p className="my-1">{children}</p>,
                          code: ({ children }) => (
                            <code className="bg-[#2d2f34] text-[#e8912d] px-1 py-0.5 rounded text-[13px] font-mono">{children}</code>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Action buttons */}
                  {msg.actionButtons && !msg.resolved && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => handleResolve(msg.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#2bac76] text-white rounded hover:bg-[#24995f] transition-colors">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </button>
                      <button onClick={() => handleJira(msg.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#36c5f0] text-[#1d1c1d] rounded hover:bg-[#2bb3de] transition-colors">
                        🎫 Create Jira Ticket
                      </button>
                      <button onClick={() => handleHandoff(msg.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#35373b] text-[#d1d2d3] rounded hover:bg-[#45474b] transition-colors border border-[#565856]">
                        <User className="h-3.5 w-3.5" /> Talk to Human
                      </button>
                    </div>
                  )}
                  {msg.resolved && (
                    <div className="mt-2 text-xs text-[#2bac76] font-medium">✅ This issue has been resolved</div>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2.5 py-2 -mx-5 px-5">
                <div className="w-9 h-9 rounded-lg bg-[#27242c] flex items-center justify-center text-lg shrink-0 mt-0.5">🤖</div>
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
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Plus className="h-4 w-4" /></div>
              </div>
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message #it-helpdesk"
                className="flex-1 bg-transparent text-[#d1d2d3] px-3 py-2.5 text-[15px] placeholder:text-[#ababad] focus:outline-none"
                disabled={typing}
              />
              <div className="flex items-center gap-0.5 px-2">
                <button
                  onClick={() => setWizardOpen(true)}
                  disabled={typing}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-[#007a5a] text-white hover:bg-[#148567] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mr-1"
                >
                  <AlertTriangle className="h-3 w-3" /> Report Issue
                </button>
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><AtSign className="h-4 w-4" /></div>
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Paperclip className="h-4 w-4" /></div>
                <div className="h-7 w-7 rounded flex items-center justify-center text-[#ababad] hover:bg-[#35373b] cursor-pointer transition-colors"><Smile className="h-4 w-4" /></div>
                <button
                  onClick={handleSend}
                  disabled={typing || !input.trim()}
                  className={`h-7 w-7 rounded flex items-center justify-center transition-colors ml-1 ${input.trim() && !typing ? 'bg-[#007a5a] text-white hover:bg-[#148567]' : 'text-[#ababad] cursor-not-allowed'}`}
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

      {/* Wizard Modal */}
      <WizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} onSubmit={handleWizardSubmit} />
    </div>
  );
};

export default SlackSimulator;

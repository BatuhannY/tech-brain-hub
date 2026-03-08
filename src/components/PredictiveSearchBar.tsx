import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type IssueLog = Tables<'issue_logs'>;

interface PredictiveSearchBarProps {
  onResults: (results: IssueLog[], query: string) => void;
  onClear: () => void;
  issues?: IssueLog[];
}

const PredictiveSearchBar = ({ onResults, onClear, issues = [] }: PredictiveSearchBarProps) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<IssueLog[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Click outside to close suggestions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Local fuzzy match for type-ahead
  const computeSuggestions = useCallback(
    (q: string) => {
      if (!q.trim() || !issues.length) {
        setSuggestions([]);
        return;
      }
      const lower = q.toLowerCase();
      const words = lower.split(/\s+/).filter(Boolean);
      const scored = issues
        .map((issue) => {
          const text = `${issue.title} ${issue.description || ''} ${issue.category}`.toLowerCase();
          let score = 0;
          words.forEach((w) => {
            if (text.includes(w)) score += 1;
          });
          if (issue.title.toLowerCase().includes(lower)) score += 3;
          return { issue, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setSuggestions(scored.map((s) => s.issue));
    },
    [issues]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      onClear();
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => computeSuggestions(value), 150);
  };

  const handleSearch = async () => {
    if (!query.trim()) { onClear(); return; }
    setShowSuggestions(false);
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', {
        body: { query: query.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('Rate limited. Please wait a moment and try again.');
        } else if (data.error.includes('Payment')) {
          toast.error('AI credits exhausted. Please add credits to continue.');
        } else {
          throw new Error(data.error);
        }
        return;
      }
      onResults(data.results || [], query.trim());
      if ((data.results || []).length === 0) {
        toast.info('No matching issues found');
      }
    } catch (err: any) {
      toast.error(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
            placeholder="AI Search — e.g., 'VPN not connecting'"
            className="pl-10 font-mono text-sm"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching} className="gap-2">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Search
        </Button>
      </div>

      {/* Type-ahead dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/30">
            Likely Matches
          </div>
          {suggestions.map((issue) => (
            <button
              key={issue.id}
              className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border last:border-0 flex items-start gap-2"
              onClick={() => {
                setQuery(issue.title);
                setShowSuggestions(false);
                // Show this single result
                onResults([issue], issue.title);
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{issue.category}</span>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <span className="text-[10px] text-muted-foreground">{issue.status}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PredictiveSearchBar;

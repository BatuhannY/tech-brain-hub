import { useState } from 'react';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type IssueLog = Tables<'issue_logs'>;

interface AISearchBarProps {
  onResults: (results: IssueLog[], query: string) => void;
  onClear: () => void;
}

const AISearchBar = ({ onResults, onClear }: AISearchBarProps) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      onClear();
      return;
    }
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
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) onClear();
          }}
          onKeyDown={handleKeyDown}
          placeholder="AI Search — e.g., 'VPN not connecting'"
          className="pl-10 font-mono text-sm"
        />
      </div>
      <Button onClick={handleSearch} disabled={searching} className="gap-2">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Search
      </Button>
    </div>
  );
};

export default AISearchBar;

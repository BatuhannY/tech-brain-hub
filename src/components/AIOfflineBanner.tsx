import { useAIStatus } from '@/hooks/useAIStatus';
import { WifiOff, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AIOfflineBanner = () => {
  const { isAIOffline, markAIOnline } = useAIStatus();

  if (!isAIOffline) return null;

  return (
    <div className="bg-[hsl(var(--status-pending))]/10 border border-[hsl(var(--status-pending))]/30 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-[hsl(var(--status-pending))]/15 flex items-center justify-center shrink-0">
        <WifiOff className="h-4 w-4 text-[hsl(var(--status-pending))]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          AI Services Offline
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI credits exhausted. Using <Database className="h-3 w-3 inline" /> database-powered search &amp; analysis instead.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs shrink-0"
        onClick={markAIOnline}
      >
        Retry AI
      </Button>
    </div>
  );
};

export default AIOfflineBanner;

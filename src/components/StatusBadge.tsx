import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const isResolved = status === 'Resolved';
  return (
    <Badge
      className={cn(
        'font-mono text-xs font-semibold border-0',
        isResolved
          ? 'bg-status-resolved-bg text-status-resolved'
          : 'bg-status-pending-bg text-status-pending'
      )}
    >
      {status}
    </Badge>
  );
};

export default StatusBadge;

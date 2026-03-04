import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const isResolved = status === 'Resolved';
  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-[11px] font-medium border-0 rounded-full px-2 py-0.5',
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

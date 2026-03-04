import { Badge } from '@/components/ui/badge';

interface CategoryBadgeProps {
  category: string;
}

const CategoryBadge = ({ category }: CategoryBadgeProps) => {
  return (
    <Badge variant="secondary" className="font-mono text-xs">
      {category}
    </Badge>
  );
};

export default CategoryBadge;

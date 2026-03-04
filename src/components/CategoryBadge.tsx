import { Badge } from '@/components/ui/badge';

interface CategoryBadgeProps {
  category: string;
}

const CategoryBadge = ({ category }: CategoryBadgeProps) => {
  return (
    <Badge variant="secondary" className="text-[11px] font-medium rounded-full px-2 py-0.5">
      {category}
    </Badge>
  );
};

export default CategoryBadge;

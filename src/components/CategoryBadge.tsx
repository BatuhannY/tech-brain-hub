import { Badge } from '@/components/ui/badge';

interface CategoryBadgeProps {
  category: string;
}

const categoryColors: Record<string, string> = {
  Billing: 'border-l-[hsl(var(--category-billing))] bg-[hsl(var(--category-billing)/0.06)]',
  Technical: 'border-l-[hsl(var(--category-technical))] bg-[hsl(var(--category-technical)/0.06)]',
  Account: 'border-l-[hsl(var(--category-account))] bg-[hsl(var(--category-account)/0.06)]',
};

export const getCategoryBorderClass = (category: string): string => {
  const map: Record<string, string> = {
    Billing: 'border-l-[hsl(var(--category-billing))]',
    Technical: 'border-l-[hsl(var(--category-technical))]',
    Account: 'border-l-[hsl(var(--category-account))]',
  };
  return map[category] || 'border-l-[hsl(var(--category-general))]';
};

const CategoryBadge = ({ category }: CategoryBadgeProps) => {
  const colorClass = categoryColors[category] || '';
  return (
    <Badge variant="secondary" className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 ${colorClass}`}>
      {category}
    </Badge>
  );
};

export default CategoryBadge;

import { ArrowUpDown } from 'lucide-react';

interface SortableHeaderProps<T extends string> {
  field: T;
  currentSortBy: T;
  sortOrder: 'asc' | 'desc';
  label: string;
  onSortChange: (field: T) => void;
  className?: string;
}

export function SortableHeader<T extends string>({
  field,
  currentSortBy,
  sortOrder,
  label,
  onSortChange,
  className = '',
}: SortableHeaderProps<T>) {
  const isActive = currentSortBy === field;
  const direction = isActive ? (sortOrder === 'asc' ? '^' : 'v') : '';

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => onSortChange(field)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSortChange(field);
      }}
      className={`inline-flex items-center gap-1 cursor-pointer hover:text-theme-primary select-none ${className}`}
    >
      <span>{label}</span>
      {isActive ? (
        <span className="text-[10px]">{direction}</span>
      ) : (
        <ArrowUpDown className="h-3 w-3" />
      )}
    </span>
  );
}

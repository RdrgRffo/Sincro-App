import { ArrowUpDown } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import type { LucideIcon } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  hideable?: boolean;
  hide?: 'md' | 'lg' | 'xl';
  className?: string;
  headerClassName?: string;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
  isLoading?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  getRowClassName?: (item: T) => string;
  actionColspan?: number;
  actionsLabel?: string;
  /** Render prop for extra content after each row (e.g. action buttons) */
  renderActions?: (item: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  sortBy,
  sortOrder,
  onSortChange,
  isLoading,
  emptyIcon,
  emptyTitle = 'Sin datos',
  emptyDescription,
  rowKey,
  onRowClick,
  getRowClassName,
  actionColspan,
  actionsLabel = 'Acciones',
  renderActions,
}: DataTableProps<T>) {
  const renderSortLabel = (field: string, label: string) => {
    const isActive = sortBy === field;
    const direction = isActive ? (sortOrder === 'asc' ? '▲' : '▼') : '';

    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => onSortChange?.(field)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSortChange?.(field); }}
        className="inline-flex items-center gap-1 cursor-pointer hover:text-theme-primary select-none"
      >
        <span>{label}</span>
        {isActive ? (
          <span className="text-[10px]">{direction}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    );
  };

  const colspan = actionColspan ?? (columns.length + (renderActions ? 1 : 0));

  return (
    <div className="overflow-x-auto rounded-xl border border-theme-color">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-theme-surface-muted/60 border-b border-theme-color">
            {columns.map((col) => {
              const hideClass = col.hide === 'md' ? 'hidden md:table-cell'
                : col.hide === 'lg' ? 'hidden lg:table-cell'
                : col.hide === 'xl' ? 'hidden xl:table-cell'
                : '';
              return (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 font-semibold text-theme-primary ${hideClass} ${col.headerClassName ?? ''}`}
                >
                  {col.sortable && onSortChange
                    ? renderSortLabel(col.key, col.label)
                    : col.label}
                </th>
              );
            })}
            {renderActions && (
              <th className="text-right px-4 py-3 font-semibold text-theme-primary">
                {actionsLabel}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={colspan} className="px-4 py-12">
                <LoadingSpinner size="lg" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={colspan} className="px-4 py-12">
                <EmptyState
                  icon={emptyIcon as LucideIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={rowKey(item)}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-theme-color hover:bg-theme-surface-muted/30 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                } ${getRowClassName?.(item) ?? ''}`}
              >
                {columns.map((col) => {
                  const hideClass = col.hide === 'md' ? 'hidden md:table-cell'
                    : col.hide === 'lg' ? 'hidden lg:table-cell'
                    : col.hide === 'xl' ? 'hidden xl:table-cell'
                    : '';
                  return (
                    <td key={col.key} className={`px-4 py-3 ${hideClass} ${col.className ?? ''}`}>
                      {col.render(item)}
                    </td>
                  );
                })}
                {renderActions && (
                  <td className="px-4 py-3 text-right">
                    {renderActions(item)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

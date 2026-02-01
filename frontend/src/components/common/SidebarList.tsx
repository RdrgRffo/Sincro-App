import { Plus, ArrowUpDown, ArrowUp, ArrowDown, List } from 'lucide-react';
import { EmptyState } from './EmptyState';
import type { LucideIcon } from 'lucide-react';

interface SidebarListItem {
  id: string;
  name: string;
  code: string;
}

interface SidebarListProps<T extends SidebarListItem> {
  items: T[];
  selectedId: string;
  isCreating: boolean;
  searchTerm: string;
  sortBy: 'name' | 'code';
  sortOrder: 'asc' | 'desc';
  title: string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  canCreate?: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: 'name' | 'code', order: 'asc' | 'desc') => void;
  onSelect: (item: T) => void;
  onNew: () => void;
  renderItem?: (item: T) => React.ReactNode;
}

export function SidebarList<T extends SidebarListItem>({
  items,
  selectedId,
  isCreating,
  searchTerm,
  sortBy,
  sortOrder,
  title,
  emptyIcon,
  emptyTitle = 'Sin elementos',
  emptyDescription,
  canCreate = true,
  onSearchChange,
  onSortChange,
  onSelect,
  onNew,
  renderItem,
}: SidebarListProps<T>) {
  const filteredAndSorted = items
    .filter(
      (item) =>
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      const cmp = a[sortBy].localeCompare(b[sortBy], 'es', { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  return (
    <aside className="rounded-xl border border-theme-color bg-theme-surface p-2.5 sm:p-3">
      <div className="flex items-center justify-between px-1 pb-2 border-b border-theme-color">
        <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Listado</p>
        <p className="text-[11px] text-theme-muted">
          {items.length} {title.toLowerCase()}
        </p>
      </div>

      <div className="p-2 space-y-2 border-b border-theme-color">
        <input
          type="text"
          placeholder="Buscar por nombre o código..."
          className="input-field text-sm w-full"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="flex items-center gap-2 text-xs px-1">
          <span className="text-theme-muted shrink-0">Ordenar por:</span>
          <button
            onClick={() =>
              onSortChange('name', sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc')
            }
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors text-xs font-medium ${
              sortBy === 'name'
                ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-700/50'
                : 'bg-theme-surface-muted text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary'
            }`}
          >
            {sortBy === 'name' ? (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3" />
            )}
            Nombre
          </button>
          <button
            onClick={() =>
              onSortChange('code', sortBy === 'code' && sortOrder === 'asc' ? 'desc' : 'asc')
            }
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors text-xs font-medium ${
              sortBy === 'code'
                ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-700/50'
                : 'bg-theme-surface-muted text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary'
            }`}
          >
            {sortBy === 'code' ? (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3" />
            )}
            Código
          </button>
        </div>
      </div>

      <div className="mt-2 p-1 space-y-1 max-h-[60vh] overflow-y-auto">
        {filteredAndSorted.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={emptyIcon ?? List}
              title={emptyTitle}
              description={emptyDescription}
            />
          </div>
        ) : (
          filteredAndSorted.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedId === item.id
                    ? 'bg-theme-surface-hover text-theme-primary shadow-sm ring-1 ring-theme-color ring-offset-1 ring-offset-theme-surface'
                    : 'text-theme-primary hover:bg-theme-surface-muted'
              }`}
            >
              {renderItem ? (
                renderItem(item)
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{item.name}</span>
                  <span className="text-xs text-theme-muted ml-2 shrink-0">{item.code}</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {canCreate && (
        <div className="mt-3 pt-3 border-t border-theme-color">
          <button
            onClick={onNew}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-theme-primary bg-theme-surface hover:bg-theme-surface-hover transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      )}
    </aside>
  );
}

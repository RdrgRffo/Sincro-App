import { Building2 } from 'lucide-react';
import { SidebarList } from '@/components/common/SidebarList';
import type { Branch } from '@/types';

interface BranchListProps {
  branches: Branch[];
  selectedBranchId: string;
  isCreatingBranch: boolean;
  searchTerm: string;
  sortBy: 'name' | 'code';
  sortOrder: 'asc' | 'desc';
  canCreate?: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: 'name' | 'code', order: 'asc' | 'desc') => void;
  onSelectBranch: (branch: Branch) => void;
  onNewBranch: () => void;
}

export function BranchList({
  branches, selectedBranchId, isCreatingBranch,
  searchTerm, sortBy, sortOrder, canCreate = true,
  onSearchChange, onSortChange, onSelectBranch, onNewBranch,
}: BranchListProps) {
  return (
    <SidebarList
      items={branches}
      selectedId={selectedBranchId}
      isCreating={isCreatingBranch}
      searchTerm={searchTerm}
      sortBy={sortBy}
      sortOrder={sortOrder}
      title="sucursales"
      emptyIcon={Building2}
      emptyTitle="Sin sucursales"
      emptyDescription="No hay sucursales registradas"
      canCreate={canCreate}
      onSearchChange={onSearchChange}
      onSortChange={onSortChange}
      onSelect={onSelectBranch}
      onNew={onNewBranch}
    />
  );
}

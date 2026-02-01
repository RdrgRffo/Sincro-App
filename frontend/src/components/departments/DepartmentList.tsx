import { Layers } from 'lucide-react';
import { SidebarList } from '@/components/common/SidebarList';
import type { Department } from '@/types';

interface DepartmentListProps {
  departments: Department[];
  selectedDepartmentId: string;
  isCreatingDepartment: boolean;
  searchTerm: string;
  sortBy: 'name' | 'code';
  sortOrder: 'asc' | 'desc';
  canCreate?: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: 'name' | 'code', order: 'asc' | 'desc') => void;
  onSelectDepartment: (department: Department) => void;
  onNewDepartment: () => void;
}

export function DepartmentList({
  departments,
  selectedDepartmentId,
  isCreatingDepartment,
  searchTerm,
  sortBy,
  sortOrder,
  canCreate = true,
  onSearchChange,
  onSortChange,
  onSelectDepartment,
  onNewDepartment,
}: DepartmentListProps) {
  return (
    <SidebarList
      items={departments}
      selectedId={selectedDepartmentId}
      isCreating={isCreatingDepartment}
      searchTerm={searchTerm}
      sortBy={sortBy}
      sortOrder={sortOrder}
      title="departamentos"
      emptyIcon={Layers}
      emptyTitle="Sin departamentos"
      emptyDescription="No hay departamentos registrados"
      canCreate={canCreate}
      onSearchChange={onSearchChange}
      onSortChange={onSortChange}
      onSelect={onSelectDepartment}
      onNew={onNewDepartment}
    />
  );
}

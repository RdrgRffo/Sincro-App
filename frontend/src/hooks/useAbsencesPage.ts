import { useMemo, useState } from 'react';
import { useAbsencesList } from '@/hooks/useAbsences';
import type { AbsenceStatus, AbsenceRequest } from '@/types';

type UseAbsencesPageOpts = {
  isAdmin: boolean;
  isGeneralManager: boolean;
  canSelectBranch: boolean;
  initialPageSize?: number;
};

export function useAbsencesPage({ isAdmin, isGeneralManager, canSelectBranch, initialPageSize = 20 }: UseAbsencesPageOpts) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(initialPageSize);
  const [statusFilter, setStatusFilter] = useState<AbsenceStatus | ''>('');
  const [branchFilter, setBranchFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'employee' | 'startDate' | 'status' | 'department' | 'branch'>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    branchId: isAdmin
      ? (branchFilter || undefined)
      : isGeneralManager && canSelectBranch
        ? (branchFilter || undefined)
        : undefined,
    departmentId: isAdmin
      ? (departmentFilter || undefined)
      : isGeneralManager
        ? (departmentFilter || undefined)
        : undefined,
    page,
    pageSize,
    search: searchQuery || undefined,
  }), [statusFilter, branchFilter, departmentFilter, page, pageSize, searchQuery, isAdmin, isGeneralManager, canSelectBranch]);

  const { data: absencesData, isLoading: absencesLoading } = useAbsencesList(filters);

  const absences = useMemo(() => absencesData?.items ?? [], [absencesData?.items]);
  const total = absencesData?.total ?? 0;
  const totalPages = absencesData?.totalPages ?? 0;

  const sortedAbsences = useMemo(() => {
    return [...absences].sort((a: AbsenceRequest, b: AbsenceRequest) => {
      let cmp = 0;
      if (sortBy === 'employee') cmp = a.employee.name.localeCompare(b.employee.name, 'es', { sensitivity: 'base' });
      else if (sortBy === 'startDate') cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status, 'es');
      else if (sortBy === 'department') cmp = (a.department?.name ?? '').localeCompare(b.department?.name ?? '', 'es');
      else if (sortBy === 'branch') cmp = (a.branch?.name ?? '').localeCompare(b.branch?.name ?? '', 'es');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [absences, sortBy, sortOrder]);

  const handleSortChange = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder('asc');
  };

  const handleStatusFilterChange = (status: AbsenceStatus | '') => { setStatusFilter(status); setPage(1); };
  const handleBranchFilterChange = (branchId: string) => { setBranchFilter(branchId); setDepartmentFilter(''); setPage(1); };
  const handleDepartmentFilterChange = (departmentId: string) => { setDepartmentFilter(departmentId); setPage(1); };
  const handleSearchChange = (query: string) => { setSearchQuery(query); setPage(1); };

  return {
    page,
    setPage,
    pageSize,
    statusFilter,
    branchFilter,
    departmentFilter,
    searchQuery,
    sortBy,
    sortOrder,
    absences,
    total,
    totalPages,
    sortedAbsences,
    absencesLoading,
    handleSortChange,
    handleStatusFilterChange,
    handleBranchFilterChange,
    handleDepartmentFilterChange,
    handleSearchChange,
    absencesData,
  };
}

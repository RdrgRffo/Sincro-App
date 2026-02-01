import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';
import type { UsersSortBy, SortOrder, User } from '@/types';

type UsersFilterKey = 'search' | 'role' | 'status' | 'departmentId' | 'branchId' | 'employeeId' | 'lastLoginFrom' | 'lastLoginTo' | 'createdFrom' | 'createdTo';

export function useUsersPage(currentUser: User | null | undefined) {
  const roleName = currentUser?.role?.name ?? '';
  const isGeneralManager = roleName === 'general_manager';
  const isDepartmentManager = roleName === 'department_manager';

  const [filters, setFilters] = useState<Record<UsersFilterKey, string>>({
    search: '', role: '', status: '', departmentId: '', employeeId: '',
    branchId: (isGeneralManager || isDepartmentManager) && currentUser?.branchId ? currentUser.branchId : '',
    lastLoginFrom: '', lastLoginTo: '', createdFrom: '', createdTo: '',
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const stableFilters = useMemo(
    () => ({
      role: filters.role,
      status: filters.status,
      departmentId: filters.departmentId,
      branchId: filters.branchId,
      employeeId: filters.employeeId,
      lastLoginFrom: filters.lastLoginFrom,
      lastLoginTo: filters.lastLoginTo,
      createdFrom: filters.createdFrom,
      createdTo: filters.createdTo,
      search: debouncedSearch,
    }),
    [
      filters.role,
      filters.status,
      filters.departmentId,
      filters.branchId,
      filters.employeeId,
      filters.lastLoginFrom,
      filters.lastLoginTo,
      filters.createdFrom,
      filters.createdTo,
      debouncedSearch,
    ],
  );

  const [sortBy, setSortBy] = useState<UsersSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const handleFilterChange = (key: UsersFilterKey, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'branchId' ? { departmentId: '' } : {}),
    }));
    setPage(1);
  };

  const handleSortChange = (field: UsersSortBy) => {
    setPage(1);
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder(field === 'createdAt' || field === 'lastLoginAt' ? 'desc' : 'asc');
  };

  const query = useQuery<{ data: User[]; pagination: { total: number; page: number; limit: number; totalPages: number } }, unknown>({
    queryKey: ['users', page, limit, stableFilters, sortBy, sortOrder],
    queryFn: () => api.get('/users', {
      params: {
        page,
        limit,
        search: stableFilters.search || undefined,
        role: stableFilters.role || undefined,
        status: stableFilters.status || undefined,
        departmentId: stableFilters.departmentId || undefined,
        employeeId: stableFilters.employeeId || undefined,
        branchId: stableFilters.branchId || undefined,
        lastLoginFrom: stableFilters.lastLoginFrom || undefined,
        lastLoginTo: stableFilters.lastLoginTo || undefined,
        createdFrom: stableFilters.createdFrom || undefined,
        createdTo: stableFilters.createdTo || undefined,
        sortBy,
        sortOrder,
      },
    }).then((r) => r.data),
  });

  return {
    filters,
    setFilters,
    stableFilters,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    page,
    setPage,
    limit,
    setLimit,
    handleFilterChange,
    handleSortChange,
    query,
  };
}

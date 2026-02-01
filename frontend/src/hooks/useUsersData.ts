import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';
import type { Branch, Department } from '@/types';

export function useUsersData(user?: { id?: string; role?: { name?: string }; branchId?: string | null; visibleBranches?: Array<{ branch: { id: string } }> } | null) {
  const isAdmin = user?.role?.name === 'admin';

  const branchesQuery = useQuery({
    queryKey: ['branches', 'users-page'],
    queryFn: () => api.get('/branches').then((r) => r.data),
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'users-page-filter'],
    queryFn: () => api.get('/departments', { params: { includeInactive: true } }).then((r) => r.data),
  });

  const availableBranches = useMemo<Branch[]>(() => branchesQuery.data?.data ?? [], [branchesQuery.data?.data]);
  const departments: Department[] = departmentsQuery.data?.data ?? [];

  const userVisibleBranchIds = useMemo(() => {
    const ids = [user?.branchId, ...(user?.visibleBranches?.map((i) => i.branch.id) ?? [])].filter(Boolean) as string[];
    return [...new Set(ids)];
  }, [user?.branchId, user?.visibleBranches]);

  const scopedBranches = useMemo(() => {
    if (isAdmin) return availableBranches;
    if (!userVisibleBranchIds.length) return [];
    return availableBranches.filter((b) => userVisibleBranchIds.includes(b.id));
  }, [isAdmin, availableBranches, userVisibleBranchIds]);

  return {
    branchesQuery,
    departmentsQuery,
    availableBranches,
    departments,
    scopedBranches,
    userVisibleBranchIds,
  };
}

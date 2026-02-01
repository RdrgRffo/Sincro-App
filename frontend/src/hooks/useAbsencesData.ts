import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';
import type { Branch, Department } from '@/types';

type AbsencesUserLike = {
  id?: string;
  branchId?: string | null;
  visibleBranches?: Array<{ branch: { id: string } }>;
  role?: { name?: string };
} | null | undefined;

export function useAbsencesData(user?: AbsencesUserLike) {
  const isAdmin = user?.role?.name === 'admin';

  const branchesQuery = useQuery({
    queryKey: ['branches', 'absences-page', user?.id, user?.role?.name],
    queryFn: () => api.get('/branches', { params: { includeInactive: true } }).then((r) => r.data),
  });

  const availableBranches = useMemo<Branch[]>(() => branchesQuery.data?.data ?? [], [branchesQuery.data?.data]);

  const userVisibleBranchIds = useMemo(() => {
    const ids = [user?.branchId, ...(user?.visibleBranches?.map((item) => item.branch.id) ?? [])].filter(Boolean) as string[];
    return [...new Set(ids)];
  }, [user?.branchId, user?.visibleBranches]);

  const scopedBranches = useMemo(() => {
    if (isAdmin) return availableBranches;
    if (!userVisibleBranchIds.length) return [];
    return availableBranches.filter((b) => userVisibleBranchIds.includes(b.id));
  }, [isAdmin, availableBranches, userVisibleBranchIds]);

  const canSelectBranch = isAdmin || userVisibleBranchIds.length > 1;

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'absences-page'],
    queryFn: () => api.get('/departments', { params: { includeInactive: true } }).then((r) => r.data),
  });

  const departments: Department[] = departmentsQuery.data?.data ?? [];

  return {
    branchesQuery,
    availableBranches,
    scopedBranches,
    canSelectBranch,
    departmentsQuery,
    departments,
  };
}

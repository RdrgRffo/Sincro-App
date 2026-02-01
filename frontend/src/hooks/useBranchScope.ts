import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getEffectiveBranchId } from '@/lib/branchSelection';
import type { Branch } from '@/types';

interface UseBranchScopeOptions {
  branches: Branch[];
}

interface UseBranchScopeReturn {
  /** All branches available to the user (unfiltered) */
  availableBranches: Branch[];
  /** IDs of branches the user can see (home branch + visible branches) */
  userVisibleBranchIds: string[];
  /** Branches scoped by role (admin sees all, others see only visible) */
  scopedBranches: Branch[];
  /** Whether the user can switch branches (admin or has multiple visible branches) */
  canSelectBranches: boolean;
  /** Default branch ID for non-admin users (home branch or first scoped branch) */
  defaultScopedBranchId: string;
  /** Resolved effective active branch ID using getEffectiveBranchId */
  effectiveActiveBranchId: string;
  /** Whether the user is admin */
  isAdmin: boolean;
  /** Whether the user is general manager */
  isGeneralManager: boolean;
  /** Whether the user is department manager */
  isDepartmentManager: boolean;
  /** Whether the user is employee */
  isEmployee: boolean;
  /** Whether the user can view all branches (admin only) */
  canViewAllBranches: boolean;
  /** Whether the user can edit schedules (admin, GM, or DM) */
  canEdit: boolean;
  /** Map of branch ID to branch name */
  branchNameById: Record<string, string>;
}

/**
 * Hook that encapsulates branch scope logic based on user role.
 * 
 * - Admin: sees all branches, can switch freely
 * - General Manager: sees home branch + visible branches
 * - Department Manager: sees home branch + visible branches
 * - Employee: sees only assigned branch
 * 
 * Also provides role-checking helpers and a branch name lookup map.
 */
export function useBranchScope(options: UseBranchScopeOptions): UseBranchScopeReturn {
  const { branches } = options;
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role?.name === 'admin';
  const isGeneralManager = user?.role?.name === 'general_manager';
  const isDepartmentManager = user?.role?.name === 'department_manager';
  const isEmployee = !isAdmin && !isGeneralManager && !isDepartmentManager;

  const canViewAllBranches = isAdmin;
  const canEdit = isAdmin || isGeneralManager || isDepartmentManager;

  const availableBranches = useMemo(() => branches ?? [], [branches]);

  const userVisibleBranchIds = useMemo(() => {
    const ids = [
      user?.branchId,
      ...(user?.visibleBranches?.map((item) => item.branch.id) ?? []),
    ].filter(Boolean) as string[];
    return [...new Set(ids)];
  }, [user?.branchId, user?.visibleBranches]);

  const scopedBranches = useMemo(() => {
    if (isAdmin) return availableBranches;
    if (!userVisibleBranchIds.length) return [];
    return availableBranches.filter((branch) => userVisibleBranchIds.includes(branch.id));
  }, [isAdmin, availableBranches, userVisibleBranchIds]);

  const canSelectBranches = isAdmin || userVisibleBranchIds.length > 1;

  const defaultScopedBranchId = useMemo(() => {
    if (isAdmin) return '';
    return user?.branchId ?? scopedBranches[0]?.id ?? '';
  }, [isAdmin, user?.branchId, scopedBranches]);

  const branchNameById = useMemo(
    () => Object.fromEntries(availableBranches.map((branch) => [branch.id, branch.name])),
    [availableBranches],
  );

  return {
    availableBranches,
    userVisibleBranchIds,
    scopedBranches,
    canSelectBranches,
    defaultScopedBranchId,
    effectiveActiveBranchId: '', // Must be computed externally with activeBranchId state
    isAdmin,
    isGeneralManager,
    isDepartmentManager,
    isEmployee,
    canViewAllBranches,
    canEdit,
    branchNameById,
  };
}

/**
 * Computes the effective active branch ID given the current selection state.
 * This is separated from useBranchScope because activeBranchId is local state
 * that changes based on user interaction.
 */
export function useEffectiveBranchId(params: {
  scopedBranches: Branch[];
  canSelectBranches: boolean;
  activeBranchId: string;
  defaultScopedBranchId: string;
  userBranchId?: string | null;
}): string {
  const { scopedBranches, canSelectBranches, activeBranchId, defaultScopedBranchId, userBranchId } = params;

  return useMemo(() => {
    return getEffectiveBranchId({
      branches: scopedBranches,
      selectedBranchId: canSelectBranches ? (activeBranchId || defaultScopedBranchId) : undefined,
      assignedBranchId: canSelectBranches ? undefined : (userBranchId ?? undefined),
      fallbackStrategy: 'none',
    });
  }, [scopedBranches, canSelectBranches, activeBranchId, defaultScopedBranchId, userBranchId]);
}

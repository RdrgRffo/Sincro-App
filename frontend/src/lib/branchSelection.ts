import type { Branch } from '@/types';

type BranchLike = Pick<Branch, 'id' | 'isActive'>;

type FallbackStrategy = 'none' | 'first' | 'active-or-first';

interface EffectiveBranchIdOptions {
  branches?: BranchLike[] | null;
  selectedBranchId?: string;
  assignedBranchId?: string;
  fallbackStrategy?: FallbackStrategy;
}

/**
 * Resolves the effective branch id for UI and data fetching.
 * - If assignedBranchId is provided, it has priority (used for non-admin views).
 * - Otherwise uses selectedBranchId if valid.
 * - Falls back according to fallbackStrategy.
 */
export function getEffectiveBranchId({
  branches,
  selectedBranchId,
  assignedBranchId,
  fallbackStrategy = 'active-or-first',
}: EffectiveBranchIdOptions): string {
  const list = branches ?? [];
  if (!list.length) return '';

  if (assignedBranchId !== undefined) {
    if (!assignedBranchId) return '';
    return list.some((branch) => branch.id === assignedBranchId) ? assignedBranchId : '';
  }

  if (selectedBranchId && list.some((branch) => branch.id === selectedBranchId)) {
    return selectedBranchId;
  }

  if (fallbackStrategy === 'none') return '';
  if (fallbackStrategy === 'first') return list[0]?.id ?? '';

  const active = list.find((branch) => branch.isActive);
  return active?.id ?? list[0]?.id ?? '';
}

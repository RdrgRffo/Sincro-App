import { describe, expect, it } from 'vitest';
import { getEffectiveBranchId } from '@/lib/branchSelection';

const branches = [
  { id: 'b-1', isActive: false },
  { id: 'b-2', isActive: true },
  { id: 'b-3', isActive: false },
];

describe('getEffectiveBranchId', () => {
  it('returns empty string when there are no branches', () => {
    expect(getEffectiveBranchId({ branches: [] })).toBe('');
    expect(getEffectiveBranchId({ branches: undefined })).toBe('');
  });

  it('prioritizes assignedBranchId when provided and valid', () => {
    expect(
      getEffectiveBranchId({
        branches,
        assignedBranchId: 'b-3',
        selectedBranchId: 'b-2',
        fallbackStrategy: 'active-or-first',
      }),
    ).toBe('b-3');
  });

  it('returns empty string when assignedBranchId is provided but invalid or empty', () => {
    expect(
      getEffectiveBranchId({
        branches,
        assignedBranchId: 'missing',
        selectedBranchId: 'b-2',
      }),
    ).toBe('');

    expect(
      getEffectiveBranchId({
        branches,
        assignedBranchId: '',
        selectedBranchId: 'b-2',
      }),
    ).toBe('');
  });

  it('uses selectedBranchId when valid and no assignedBranchId', () => {
    expect(
      getEffectiveBranchId({
        branches,
        selectedBranchId: 'b-1',
        fallbackStrategy: 'active-or-first',
      }),
    ).toBe('b-1');
  });

  it('falls back to active branch then first for active-or-first strategy', () => {
    expect(
      getEffectiveBranchId({
        branches,
        selectedBranchId: 'missing',
        fallbackStrategy: 'active-or-first',
      }),
    ).toBe('b-2');

    expect(
      getEffectiveBranchId({
        branches: [{ id: 'x-1', isActive: false }, { id: 'x-2', isActive: false }],
        selectedBranchId: 'missing',
        fallbackStrategy: 'active-or-first',
      }),
    ).toBe('x-1');
  });

  it('supports fallbackStrategy none and first', () => {
    expect(
      getEffectiveBranchId({
        branches,
        selectedBranchId: 'missing',
        fallbackStrategy: 'none',
      }),
    ).toBe('');

    expect(
      getEffectiveBranchId({
        branches,
        selectedBranchId: 'missing',
        fallbackStrategy: 'first',
      }),
    ).toBe('b-1');
  });
});

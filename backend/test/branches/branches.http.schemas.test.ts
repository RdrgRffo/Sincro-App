/**
 * @file branches.http.schemas.test.ts
 * Tests de validación Zod para los schemas HTTP de sucursales.
 */

import {
  branchIdParamsSchema,
  holidayIdParamsSchema,
  listBranchesQuerySchema,
  createBranchBodySchema,
  updateBranchBodySchema,
  listBranchHolidaysQuerySchema,
  createBranchHolidayBodySchema,
  updateBranchHolidayBodySchema,
  bulkUpdateBranchHolidayBodySchema,
  bulkDeleteBranchHolidayBodySchema,
} from '../../src/modules/branches/branches.http.schemas';

describe('branches.http.schemas', () => {
  describe('branchIdParamsSchema', () => {
    it('accepts valid branchId', () => {
      const result = branchIdParamsSchema.safeParse({ branchId: 'b-1' });
      expect(result.success).toBe(true);
    });

    it('rejects empty branchId', () => {
      const result = branchIdParamsSchema.safeParse({ branchId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('holidayIdParamsSchema', () => {
    it('accepts valid params', () => {
      const result = holidayIdParamsSchema.safeParse({ branchId: 'b-1', holidayId: 'h-1' });
      expect(result.success).toBe(true);
    });
  });

  describe('createBranchBodySchema', () => {
    const validBranch = {
      name: 'Sucursal Centro',
      code: 'SC001',
    };

    it('accepts valid branch', () => {
      const result = createBranchBodySchema.safeParse(validBranch);
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = createBranchBodySchema.safeParse({ ...validBranch, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid code format (special chars)', () => {
      const result = createBranchBodySchema.safeParse({ ...validBranch, code: 'AB@CD' });
      expect(result.success).toBe(false);
    });

    it('rejects code too short', () => {
      const result = createBranchBodySchema.safeParse({ ...validBranch, code: 'A' });
      expect(result.success).toBe(false);
    });

    it('accepts with optional fields', () => {
      const result = createBranchBodySchema.safeParse({
        ...validBranch,
        address: 'Calle 123',
        city: 'Madrid',
        countryCode: 'ES',
        timezone: 'Europe/Madrid',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateBranchBodySchema', () => {
    it('accepts partial update', () => {
      const result = updateBranchBodySchema.safeParse({ name: 'Updated' });
      expect(result.success).toBe(true);
    });

    it('accepts isActive flag', () => {
      const result = updateBranchBodySchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });
  });

  describe('createBranchHolidayBodySchema', () => {
    it('accepts valid holiday', () => {
      const result = createBranchHolidayBodySchema.safeParse({
        date: '2026-12-25T00:00:00.000Z',
        name: 'Navidad',
        type: 'nacional',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid type', () => {
      const result = createBranchHolidayBodySchema.safeParse({
        date: '2026-12-25T00:00:00.000Z',
        name: 'Navidad',
        type: 'invalid_type',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkUpdateBranchHolidayBodySchema', () => {
    it('accepts valid bulk update', () => {
      const result = bulkUpdateBranchHolidayBodySchema.safeParse({
        holidayIds: ['h-1', 'h-2'],
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty holidayIds', () => {
      const result = bulkUpdateBranchHolidayBodySchema.safeParse({
        holidayIds: [],
        name: 'Updated',
      });
      expect(result.success).toBe(false);
    });

    it('rejects without any update field', () => {
      const result = bulkUpdateBranchHolidayBodySchema.safeParse({
        holidayIds: ['h-1'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkDeleteBranchHolidayBodySchema', () => {
    it('accepts valid bulk delete', () => {
      const result = bulkDeleteBranchHolidayBodySchema.safeParse({
        holidayIds: ['h-1', 'h-2'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty holidayIds', () => {
      const result = bulkDeleteBranchHolidayBodySchema.safeParse({
        holidayIds: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

/**
 * @file departments.http.schemas.test.ts
 * Tests de validación Zod para los schemas HTTP de departamentos.
 */

import {
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  createDepartmentBodySchema,
  updateDepartmentBodySchema,
  assignDepartmentManagerBodySchema,
} from '../../src/modules/departments/departments.http.schemas';

describe('departments.http.schemas', () => {
  describe('departmentIdParamsSchema', () => {
    it('accepts valid departmentId', () => {
      const result = departmentIdParamsSchema.safeParse({ departmentId: 'dept-1' });
      expect(result.success).toBe(true);
    });

    it('rejects empty departmentId', () => {
      const result = departmentIdParamsSchema.safeParse({ departmentId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('listDepartmentsQuerySchema', () => {
    it('accepts empty query', () => {
      const result = listDepartmentsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts with branchId filter', () => {
      const result = listDepartmentsQuerySchema.safeParse({ branchId: 'b-1' });
      expect(result.success).toBe(true);
    });
  });

  describe('createDepartmentBodySchema', () => {
    const validDept = {
      name: 'Recursos Humanos',
      code: 'RRHH',
      branchIds: ['b-1'],
    };

    it('accepts valid department', () => {
      const result = createDepartmentBodySchema.safeParse(validDept);
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = createDepartmentBodySchema.safeParse({ ...validDept, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid code format (special chars)', () => {
      const result = createDepartmentBodySchema.safeParse({ ...validDept, code: 'AB@CD' });
      expect(result.success).toBe(false);
    });

    it('rejects code too short', () => {
      const result = createDepartmentBodySchema.safeParse({ ...validDept, code: 'A' });
      expect(result.success).toBe(false);
    });

    it('rejects empty branchIds', () => {
      const result = createDepartmentBodySchema.safeParse({ ...validDept, branchIds: [] });
      expect(result.success).toBe(false);
    });

    it('rejects missing branchIds', () => {
      const { branchIds, ...noBranches } = validDept;
      const result = createDepartmentBodySchema.safeParse(noBranches);
      expect(result.success).toBe(false);
    });

    it('accepts with description', () => {
      const result = createDepartmentBodySchema.safeParse({
        ...validDept,
        description: 'Departamento de RRHH',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateDepartmentBodySchema', () => {
    it('accepts partial update with only name', () => {
      const result = updateDepartmentBodySchema.safeParse({ name: 'Updated Dept' });
      expect(result.success).toBe(true);
    });

    it('accepts isActive flag', () => {
      const result = updateDepartmentBodySchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it('accepts branchIds update', () => {
      const result = updateDepartmentBodySchema.safeParse({ branchIds: ['b-1', 'b-2'] });
      expect(result.success).toBe(true);
    });

    it('accepts empty body (no fields)', () => {
      const result = updateDepartmentBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts code update with valid code', () => {
      const result = updateDepartmentBodySchema.safeParse({ code: 'NEWCODE' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('NEWCODE');
      }
    });

    it('accepts code update with lowercase and trims it', () => {
      const result = updateDepartmentBodySchema.safeParse({ code: '  new-code  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('NEW-CODE');
      }
    });

    it('rejects invalid code format', () => {
      const result = updateDepartmentBodySchema.safeParse({ code: 'AB@CD' });
      expect(result.success).toBe(false);
    });

    it('rejects code too short', () => {
      const result = updateDepartmentBodySchema.safeParse({ code: 'A' });
      expect(result.success).toBe(false);
    });

    it('accepts branchIds as undefined (not provided)', () => {
      const result = updateDepartmentBodySchema.safeParse({ name: 'Only Name' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.branchIds).toBeUndefined();
      }
    });

    it('rejects empty branchIds array', () => {
      const result = updateDepartmentBodySchema.safeParse({ branchIds: [] });
      expect(result.success).toBe(false);
    });

    it('accepts all fields at once', () => {
      const result = updateDepartmentBodySchema.safeParse({
        name: 'Full Update',
        code: 'FULL',
        description: 'Updated description',
        isActive: true,
        branchIds: ['b-1'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts description as undefined', () => {
      const result = updateDepartmentBodySchema.safeParse({ name: 'Test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });
  });

  describe('assignDepartmentManagerBodySchema', () => {
    it('accepts valid userId', () => {
      const result = assignDepartmentManagerBodySchema.safeParse({ userId: 'user-1' });
      expect(result.success).toBe(true);
    });

    it('rejects empty userId', () => {
      const result = assignDepartmentManagerBodySchema.safeParse({ userId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing userId', () => {
      const result = assignDepartmentManagerBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

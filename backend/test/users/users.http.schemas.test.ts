/**
 * @file users.http.schemas.test.ts
 * Tests de validación Zod para los schemas HTTP de usuarios.
 */

import {
  userIdParamsSchema,
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  changeStatusBodySchema,
  changeRoleBodySchema,
  resetPasswordBodySchema,
} from '../../src/modules/users/users.http.schemas';

describe('users.http.schemas', () => {
  describe('userIdParamsSchema', () => {
    it('accepts valid id', () => {
      const result = userIdParamsSchema.safeParse({ id: 'user-1' });
      expect(result.success).toBe(true);
    });

    it('rejects empty id', () => {
      const result = userIdParamsSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('listUsersQuerySchema', () => {
    it('accepts empty query (defaults)', () => {
      const result = listUsersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('accepts valid filters', () => {
      const result = listUsersQuerySchema.safeParse({
        role: 'admin',
        status: 'active',
        search: 'juan',
        page: '2',
        limit: '10',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid role', () => {
      const result = listUsersQuerySchema.safeParse({ role: 'superadmin' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid status', () => {
      const result = listUsersQuerySchema.safeParse({ status: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('createUserBodySchema', () => {
    const validUser = {
      name: 'Juan Perez',
      email: 'juan@test.com',
      password: 'password123',
      branchId: 'b-1',
    };

    it('accepts valid user', () => {
      const result = createUserBodySchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = createUserBodySchema.safeParse({ ...validUser, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = createUserBodySchema.safeParse({ ...validUser, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = createUserBodySchema.safeParse({ ...validUser, password: '123' });
      expect(result.success).toBe(false);
    });

    it('rejects missing branchId', () => {
      const { branchId, ...noBranch } = validUser;
      const result = createUserBodySchema.safeParse(noBranch);
      expect(result.success).toBe(false);
    });

    it('accepts with optional fields', () => {
      const result = createUserBodySchema.safeParse({
        ...validUser,
        role: 'general_manager',
        status: 'active',
        employeeId: 'EMP-001',
        skillIds: ['skill-1'],
        visibleBranchIds: ['branch-1', 'branch-2'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateUserBodySchema', () => {
    it('accepts partial update', () => {
      const result = updateUserBodySchema.safeParse({ name: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (partial)', () => {
      const result = updateUserBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts skills and visible branches in partial updates', () => {
      const result = updateUserBodySchema.safeParse({
        skillIds: ['skill-1', 'skill-2'],
        visibleBranchIds: ['branch-1'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('changeStatusBodySchema', () => {
    it('accepts valid status', () => {
      const result = changeStatusBodySchema.safeParse({ status: 'disabled' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = changeStatusBodySchema.safeParse({ status: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('changeRoleBodySchema', () => {
    it('accepts valid role', () => {
      const result = changeRoleBodySchema.safeParse({ role: 'department_manager' });
      expect(result.success).toBe(true);
    });

    it('accepts roleId', () => {
      const result = changeRoleBodySchema.safeParse({ roleId: 'role-1' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid role', () => {
      const result = changeRoleBodySchema.safeParse({ role: 'superadmin' });
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordBodySchema', () => {
    it('accepts valid password', () => {
      const result = resetPasswordBodySchema.safeParse({ newPassword: 'newPassword123' });
      expect(result.success).toBe(true);
    });

    it('rejects short password', () => {
      const result = resetPasswordBodySchema.safeParse({ newPassword: '123' });
      expect(result.success).toBe(false);
    });
  });
});

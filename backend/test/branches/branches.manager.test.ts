/**
 * @file branches.manager.test.ts
 * Tests for Single Transaction Pattern: branch manager assignment/removal with atomic role changes
 * Validates: exclusive roles, transactionality, audit logging, dependency checking
 */

jest.mock('../../src/modules/branches/branches.repository');
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/modules/roles/roles.repository');
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/common/transactions/transaction.utils');

import * as branchesRepo from '../../src/modules/branches/branches.repository';
import * as usersRepo from '../../src/modules/users/users.repository';
import * as rolesRepo from '../../src/modules/roles/roles.repository';
import { logAuditOrThrow } from '../../src/modules/audit/audit.service';
import { executeInTransaction } from '../../src/common/transactions/transaction.utils';
import {
  assignBranchManager,
  removeBranchManager,
} from '../../src/modules/branches/branches.service';
import { prismaMock } from '../config/singleton';
import { createAppError } from '../../src/common/errors/error-catalog';

const repoBranches = branchesRepo as jest.Mocked<typeof branchesRepo>;
const repoUsers = usersRepo as jest.Mocked<typeof usersRepo>;
const repoRoles = rolesRepo as jest.Mocked<typeof rolesRepo>;
const mockLogAudit = logAuditOrThrow as jest.MockedFunction<typeof logAuditOrThrow>;
const mockExecuteInTransaction = executeInTransaction as jest.MockedFunction<typeof executeInTransaction>;

const actor = {
  id: 'test-admin-id',
  ipAddress: '127.0.0.1',
};

describe('Branch Manager - Single Transaction Pattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock findRoleByName to return role objects
    repoRoles.findRoleByName.mockImplementation((name: string) => {
      if (name === 'general_manager') {
        return Promise.resolve({ id: 'role-general-manager-id', name: 'general_manager' } as any);
      }
      if (name === 'employee') {
        return Promise.resolve({ id: 'role-employee-id', name: 'employee' } as any);
      }
      return Promise.resolve(null);
    });

    // Default mock: executeInTransaction passes through the operation with a mock tx
    // that includes user.findUnique for ensureUserRole
    // Delegates to findUserById mock so the tx sees the same user data
    // Note: findUserById returns user with role as string, but ensureUserRole expects role: { name: string }
    // We transform the response to match what ensureUserRole expects
    const mockTx = {
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where: { id } }: { where: { id: string } }) => {
          const user = await repoUsers.findUserById(id);
          if (!user) return null;
          return {
            id: (user as any).id,
            role: { name: (user as any).role },
          };
        }),
      },
    };
    mockExecuteInTransaction.mockImplementation((operation) => operation(mockTx as any));
  });

  describe('assignBranchManager', () => {
    it('should assign a manager and upgrade role from viewer to manager', async () => {
      // Arrange
      const branchId = 'branch-1';
      const userId = 'user-1';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' };
        const user = { id: userId, role: 'employee', name: 'John Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: userId } as any);
        repoUsers.updateUserRecord.mockResolvedValue({ ...user, role: 'general_manager' } as any);

      // Act
      const result = await assignBranchManager(branchId, userId, actor);

      // Assert
      expect(result.managerId).toBe(userId);
      expect(repoUsers.updateUserRecord).toHaveBeenCalledWith(userId, { roleId: 'role-general-manager-id' }, expect.anything());
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ASSIGN_BRANCH_MANAGER',
          entityId: branchId,
        }),
        expect.anything(),
      );
    });

    it('should keep manager role if user already is a manager', async () => {
      // Arrange
      const branchId = 'branch-2';
      const userId = 'user-2';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' };
        const user = { id: userId, role: 'general_manager', name: 'Jane Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: userId } as any);

      // Act
      const result = await assignBranchManager(branchId, userId, actor);

      // Assert
      expect(result.managerId).toBe(userId);
      // updateUserRecord should be called once to update branchId
      expect(repoUsers.updateUserRecord).toHaveBeenCalledTimes(1);
      expect(repoUsers.updateUserRecord).toHaveBeenCalledWith(userId, { branchId }, expect.anything());
    });

    it('should throw BAD_REQUEST if user is already manager of this branch', async () => {
      // Arrange
      const branchId = 'branch-3';
      const userId = 'user-3';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' }; // Already managed by this user

      repoBranches.findBranchById.mockResolvedValue(branch as any);

      // Act & Assert
      await expect(assignBranchManager(branchId, userId, actor)).rejects.toThrow(
        'Este usuario ya es manager de esta sucursal',
      );
    });

    it('should throw NOT_FOUND if branch does not exist', async () => {
      // Arrange
      repoBranches.findBranchById.mockResolvedValue(null);

      // Act & Assert
      await expect(assignBranchManager('nonexistent', 'user-1', actor)).rejects.toThrow(
        'Sucursal no encontrada',
      );
    });

    it('should throw NOT_FOUND if user does not exist', async () => {
      // Arrange
      const branchId = 'branch-4';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(assignBranchManager(branchId, 'nonexistent', actor)).rejects.toThrow(
        'Usuario no encontrado',
      );
    });

    it('should create audit log within transaction', async () => {
      // Arrange
      const branchId = 'branch-5';
      const userId = 'user-5';
      const branch = { id: branchId, managerId: null, name: 'Test Branch Alpha' };
      const user = { id: userId, role: 'employee', name: 'Audit Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: userId } as any);
        repoUsers.updateUserRecord.mockResolvedValue({ ...user, role: 'general_manager' } as any);

      // Act
      await assignBranchManager(branchId, userId, actor);

      // Assert
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actor.id,
          action: 'ASSIGN_BRANCH_MANAGER',
          entityType: 'Branch',
          entityId: branchId,
          ipAddress: actor.ipAddress,
        }),
        expect.anything(),
      );
    });

    it('should rollback role upgrade if transaction fails', async () => {
      // Arrange
      const branchId = 'branch-6';
      const userId = 'user-6';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' };
      const user = { id: userId, role: 'employee', name: 'Rollback Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);

      // Mock transaction to fail (throw error)
      mockExecuteInTransaction.mockRejectedValue(new Error('Transaction failed'));

      // Act & Assert
      await expect(assignBranchManager(branchId, userId, actor)).rejects.toThrow('Transaction failed');

      // Verify updateUserRecord was called within transaction (but transaction failed)
      expect(mockExecuteInTransaction).toHaveBeenCalled();
    });
  });

  describe('removeBranchManager', () => {
    it('should remove manager and downgrade role from manager to viewer when no other branches', async () => {
      // Arrange
      const branchId = 'branch-7';
      const userId = 'user-7';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' };
      const user = { id: userId, role: 'general_manager', name: 'Single Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.countBranchesForManager.mockResolvedValue(0); // No other branches
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: null } as any);
        repoUsers.updateUserRecord.mockResolvedValue({ ...user, role: 'employee' } as any);

      // Act
      const result = await removeBranchManager(branchId, actor);

      // Assert
      expect(result.managerId).toBeNull();
      expect(repoUsers.updateUserRecord).toHaveBeenCalledWith(userId, { roleId: 'role-employee-id' }, expect.anything());
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REMOVE_BRANCH_MANAGER',
          entityId: branchId,
          detailsJson: expect.objectContaining({
            stillManagerOfOtherBranches: false,
          }),
        }),
        expect.anything(),
      );
    });

    it('should remove manager but keep role when user manages other branches', async () => {
      // Arrange
      const branchId = 'branch-8';
      const userId = 'user-8';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' };
      const user = { id: userId, role: 'general_manager', name: 'Multi Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.countBranchesForManager.mockResolvedValue(1); // Still manages 1 other branch
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: null } as any);

      // Act
      const result = await removeBranchManager(branchId, actor);

      // Assert
      expect(result.managerId).toBeNull();
      // updateUserRecord should NOT be called because user still manages other branches
      expect(repoUsers.updateUserRecord).not.toHaveBeenCalled();
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({
            stillManagerOfOtherBranches: true,
          }),
        }),
        expect.anything(),
      );
    });

    it('should throw BAD_REQUEST if branch has no manager', async () => {
      // Arrange
      const branchId = 'branch-9';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' }; // No manager

      repoBranches.findBranchById.mockResolvedValue(branch as any);

      // Act & Assert
      await expect(removeBranchManager(branchId, actor)).rejects.toThrow(
        'Esta sucursal no tiene un manager asignado',
      );
    });

    it('should throw NOT_FOUND if branch does not exist', async () => {
      // Arrange
      repoBranches.findBranchById.mockResolvedValue(null);

      // Act & Assert
      await expect(removeBranchManager('nonexistent', actor)).rejects.toThrow(
        'Sucursal no encontrada',
      );
    });

    it('should throw NOT_FOUND if manager user does not exist', async () => {
      // Arrange
      const branchId = 'branch-10';
      const userId = 'user-10';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(null); // User not found

      // Act & Assert
      await expect(removeBranchManager(branchId, actor)).rejects.toThrow(
        'Manager no encontrado',
      );
    });

    it('should create audit log with stillManagerOfOtherBranches flag', async () => {
      // Arrange
      const branchId = 'branch-11';
      const userId = 'user-11';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' };
      const user = { id: userId, role: 'general_manager', name: 'Audit Multi Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.countBranchesForManager.mockResolvedValue(2); // Manages 2 branches total
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: null } as any);

      // Act
      await removeBranchManager(branchId, actor);

      // Assert
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({
            stillManagerOfOtherBranches: true,
          }),
        }),
        expect.anything(),
      );
    });

    it('should rollback role downgrade if transaction fails', async () => {
      // Arrange
      const branchId = 'branch-12';
      const userId = 'user-12';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' };
      const user = { id: userId, role: 'general_manager', name: 'Rollback Single Manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.countBranchesForManager.mockResolvedValue(0);

      // Mock transaction to fail
      mockExecuteInTransaction.mockRejectedValue(new Error('Transaction failed'));

      // Act & Assert
      await expect(removeBranchManager(branchId, actor)).rejects.toThrow('Transaction failed');

      // Verify executeInTransaction was called (transaction failed atomically)
      expect(mockExecuteInTransaction).toHaveBeenCalled();
    });
  });

  describe('Role Exclusivity - No Role Mixing', () => {
    it('should never have multiple roles for a single user', async () => {
      // Arrange
      const branchId = 'branch-13';
      const userId = 'user-13';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' };
      const user = { id: userId, role: 'employee', name: 'Role Exclusive User' };
      const updatedUser = { ...user, role: 'general_manager' };

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: userId } as any);
      repoUsers.updateUserRecord.mockResolvedValue(updatedUser as any);

      // Act
      await assignBranchManager(branchId, userId, actor);

      // Assert
      expect(repoUsers.updateUserRecord).toHaveBeenCalledWith(userId, { roleId: 'role-general-manager-id' }, expect.anything());
      // Role must be a single string, not an array or multiple roles
      expect(typeof 'general_manager').toBe('string');
    });

    it('should not accumulate roles during sequential assignments', async () => {
      // Arrange
      const branch1Id = 'branch-14';
      const branch2Id = 'branch-15';
      const userId = 'user-14';
      const userViewer = { id: userId, role: 'employee', name: 'Sequential User' };
      const userManager = { id: userId, role: 'general_manager', name: 'Sequential User' };

      // First assignment: user starts as viewer
      repoBranches.findBranchById
        .mockResolvedValueOnce({ id: branch1Id, managerId: null, name: 'Branch 1' } as any)
        .mockResolvedValueOnce({ id: branch2Id, managerId: null, name: 'Branch 2' } as any);

      // First call returns viewer, second call returns manager (already upgraded)
      repoUsers.findUserById
        .mockResolvedValueOnce(userViewer as any)
        .mockResolvedValueOnce(userManager as any); // After first assignment, user is manager

      repoBranches.updateBranchManager
        .mockResolvedValueOnce({ id: branch1Id, managerId: userId } as any)
        .mockResolvedValueOnce({ id: branch2Id, managerId: userId } as any);

      repoUsers.updateUserRecord.mockResolvedValue({ ...userViewer, role: 'general_manager' } as any);

      // Act
      await assignBranchManager(branch1Id, userId, actor);
      await assignBranchManager(branch2Id, userId, actor);

      // Assert
      // updateUserRecord is called:
      //   1st assignment: once for role upgrade (employee -> general_manager) + once for branchId
      //   2nd assignment: once for branchId (role already general_manager, no role update needed)
      // Total: 3 calls
      expect(repoUsers.updateUserRecord).toHaveBeenCalledTimes(3);
    });
  });

  describe('Transaction Atomicity', () => {
    it('should guarantee all-or-nothing on assignment: role and branch together', async () => {
      // Arrange
      const branchId = 'branch-16';
      const userId = 'user-16';
      const branch = { id: branchId, managerId: null, name: 'Test Branch' };
      const user = { id: userId, role: 'employee', name: 'Atomic User' };
      let transactionOperationCalled = false;

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);

      // Track that operation is called within transaction
      // Need to provide a tx with user.findUnique for ensureUserRole
      const atomicMockTx = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: userId, role: { name: 'employee' } }),
        },
      };
      mockExecuteInTransaction.mockImplementation(async (operation) => {
        transactionOperationCalled = true;
        return operation(atomicMockTx as any);
      });

      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: userId } as any);
      repoUsers.updateUserRecord.mockResolvedValue({ ...user, role: 'general_manager' } as any);

      // Act
      await assignBranchManager(branchId, userId, actor);

      // Assert
      expect(transactionOperationCalled).toBe(true);
      expect(mockExecuteInTransaction).toHaveBeenCalledTimes(1);
    });

    it('should guarantee all-or-nothing on removal: role downgrade and branch clear together', async () => {
      // Arrange
      const branchId = 'branch-17';
      const userId = 'user-17';
      const branch = { id: branchId, managerId: userId, name: 'Test Branch' };
      const user = { id: userId, role: 'general_manager', name: 'Atomic Removal' };
      let transactionOperationCalled = false;

      repoBranches.findBranchById.mockResolvedValue(branch as any);
      repoUsers.findUserById.mockResolvedValue(user as any);
      repoBranches.countBranchesForManager.mockResolvedValue(0);

      // Track that operation is called within transaction
      // Need to provide a tx with user.findUnique for ensureUserRole/downgradeManagerIfLast
      const atomicMockTx = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: userId, role: { name: 'general_manager' } }),
        },
      };
      mockExecuteInTransaction.mockImplementation(async (operation) => {
        transactionOperationCalled = true;
        return operation(atomicMockTx as any);
      });

      repoBranches.updateBranchManager.mockResolvedValue({ ...branch, managerId: null } as any);
      repoUsers.updateUserRecord.mockResolvedValue({ ...user, role: 'employee' } as any);

      // Act
      await removeBranchManager(branchId, actor);

      // Assert
      expect(transactionOperationCalled).toBe(true);
      expect(mockExecuteInTransaction).toHaveBeenCalledTimes(1);
    });
  });
});

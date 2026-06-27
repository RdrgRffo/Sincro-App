/**
 * @file roles.service.test.ts
 * Tests del servicio de roles: CRUD, protección de roles de sistema, transacciones con audit.
 */

jest.mock('../../src/modules/roles/roles.repository', () => ({
  findRoles: jest.fn(),
  findRoleById: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  getPermissions: jest.fn(),
}));

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => {
    const tx = {};
    return fn(tx);
  }),
}));

import * as repo from '../../src/modules/roles/roles.repository';
import { prismaMock } from '../config/singleton';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
} from '../../src/modules/roles/roles.service';

const mockRepo = repo as jest.Mocked<typeof repo>;

describe('roles.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listRoles', () => {
    it('retorna todos los roles con permisos', async () => {
      const mockRoles = [
        { id: 'role-1', name: 'admin', description: 'Admin', isSystem: true, permissions: [] },
        { id: 'role-2', name: 'employee', description: 'Employee', isSystem: true, permissions: [] },
      ];
      mockRepo.findRoles.mockResolvedValue(mockRoles as any);

      const result = await listRoles();

      expect(result).toEqual(mockRoles);
      expect(mockRepo.findRoles).toHaveBeenCalled();
    });
  });

  describe('getRole', () => {
    it('retorna un rol por ID', async () => {
      const mockRole = { id: 'role-1', name: 'admin', description: 'Admin', isSystem: true, permissions: [] };
      mockRepo.findRoleById.mockResolvedValue(mockRole as any);

      const result = await getRole('role-1');

      expect(result).toEqual(mockRole);
    });

    it('lanza error si el rol no existe', async () => {
      mockRepo.findRoleById.mockResolvedValue(null);

      await expect(getRole('role-invalid')).rejects.toThrow('Role no encontrado');
    });
  });

  describe('createRole', () => {
    it('crea un nuevo rol con audit', async () => {
      const input = { name: 'supervisor', description: 'Supervisor de turno', permissions: ['schedules:view' as const] };
      const created = { id: 'role-3', ...input, isSystem: false, permissions: [{ name: 'schedules:view' }] };
      mockRepo.createRole.mockResolvedValue(created as any);

      const result = await createRole(input);

      expect(mockRepo.createRole).toHaveBeenCalledWith(input);
      expect(result).toEqual(created);
    });
  });

  describe('updateRole', () => {
    it('actualiza un rol existente', async () => {
      const existing = { id: 'role-1', name: 'admin', description: 'Admin', isSystem: true, permissions: [] };
      const updated = { ...existing, description: 'Super Admin' };
      mockRepo.findRoleById.mockResolvedValue(existing as any);
      mockRepo.updateRole.mockResolvedValue(updated as any);

      const result = await updateRole('role-1', { description: 'Super Admin' });

      expect(mockRepo.updateRole).toHaveBeenCalledWith('role-1', { description: 'Super Admin' });
      expect(result.description).toBe('Super Admin');
    });

    it('lanza error si se intenta cambiar el nombre de un rol de sistema', async () => {
      const existing = { id: 'role-1', name: 'admin', description: 'Admin', isSystem: true, permissions: [] };
      mockRepo.findRoleById.mockResolvedValue(existing as any);

      await expect(
        updateRole('role-1', { name: 'superadmin' })
      ).rejects.toThrow('No se puede cambiar el nombre de un rol de sistema');
    });

    it('lanza error si el rol no existe', async () => {
      mockRepo.findRoleById.mockResolvedValue(null);

      await expect(
        updateRole('role-invalid', { description: 'Test' })
      ).rejects.toThrow('Role no encontrado');
    });
  });

  describe('deleteRole', () => {
    it('elimina un rol no-sistema', async () => {
      const existing = { id: 'role-3', name: 'supervisor', isSystem: false, permissions: [] };
      mockRepo.findRoleById.mockResolvedValue(existing as any);
      prismaMock.user.count.mockResolvedValue(0 as any);

      await deleteRole('role-3');

      expect(mockRepo.deleteRole).toHaveBeenCalledWith('role-3');
    });

    it('lanza error si hay usuarios asignados al rol', async () => {
      const existing = { id: 'role-3', name: 'supervisor', isSystem: false, permissions: [] };
      mockRepo.findRoleById.mockResolvedValue(existing as any);
      prismaMock.user.count.mockResolvedValue(2 as any);

      await expect(deleteRole('role-3')).rejects.toThrow('usuario(s)');
      expect(mockRepo.deleteRole).not.toHaveBeenCalled();
    });

    it('lanza error al intentar eliminar un rol de sistema', async () => {
      const existing = { id: 'role-1', name: 'admin', isSystem: true, permissions: [] };
      mockRepo.findRoleById.mockResolvedValue(existing as any);

      await expect(deleteRole('role-1')).rejects.toThrow('No se pueden borrar roles de sistema');
    });

    it('lanza error si el rol no existe', async () => {
      mockRepo.findRoleById.mockResolvedValue(null);

      await expect(deleteRole('role-invalid')).rejects.toThrow('Role no encontrado');
    });
  });

  describe('listPermissions', () => {
    it('retorna todas las permisos disponibles', async () => {
      const mockPerms = [{ name: 'schedules:view' }, { name: 'schedules:create' }];
      mockRepo.getPermissions.mockResolvedValue(mockPerms as any);

      const result = await listPermissions();

      expect(result).toEqual(mockPerms);
    });
  });
});

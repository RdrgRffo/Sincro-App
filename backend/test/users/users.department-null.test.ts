/** Test for explicit null departmentId handling in updateUser */
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/realtime/socket', () => ({ publishRealtimeEvent: jest.fn() }));
jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({ createInAppNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/utils/bcrypt', () => ({ hashPassword: jest.fn().mockResolvedValue('hashed_password') }));
jest.mock('../../src/common/transactions/transaction.utils', () => ({ executeInTransaction: jest.fn((fn: any) => fn({ userVisibleBranch: { deleteMany: jest.fn(), createMany: jest.fn() }, userSkill: { deleteMany: jest.fn(), createMany: jest.fn() } })) }));

import { prismaMock } from '../config/singleton';
import * as usersRepo from '../../src/modules/users/users.repository';
import { updateUser } from '../../src/modules/users/users.service';

const mockRepo = usersRepo as jest.Mocked<typeof usersRepo>;
const mockActor = { id: 'admin-id-1', ipAddress: '127.0.0.1' };

beforeEach(() => {
  prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch-1' } as any);
  prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-1', branches: [{ branchId: 'branch-1' }] } as any);
  (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'admin-id-1', roleId: 'role-admin-id', branchId: 'branch-1' } as any);
  mockRepo.findUserDetailById.mockResolvedValue({ id: 'user-id-1', branchId: 'branch-1', departmentId: 'dept-1', email: 'test@example.com', name: 'Test' } as any);
  mockRepo.findUserIdentityConflict.mockResolvedValue(null as any);
});

it('rejects explicit null departmentId in updateUser', async () => {
  await expect(updateUser('user-id-1', { departmentId: null } as any, mockActor)).rejects.toThrow('No está permitido eliminar el departamento mediante este endpoint');
});

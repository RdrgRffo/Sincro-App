import { prismaMock } from '../config/singleton';
import { exportAuditLogsCsv } from '../../src/modules/audit/audit.service';

describe('audit.exportAuditLogsCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates CSV with headers and rows', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        user: { id: 'u1', name: 'Alice', email: 'alice@test.com' },
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: 'user-1',
        ipAddress: '127.0.0.1',
        rolledBackBy: null,
        rolledBackAt: null,
      },
    ] as any);

    const csv = await exportAuditLogsCsv({});
    expect(csv).toContain('ID,Fecha,Usuario,Email,Acción,Entidad,ID Entidad,IP,Revertido Por,Revertido En');
    expect(csv).toContain('log-1');
    expect(csv).toContain('Alice');
    expect(csv).toContain('CREATE_USER');
  });
});

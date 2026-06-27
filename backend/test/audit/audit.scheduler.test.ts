import { prismaMock } from '../config/singleton';
import { cleanupOldAuditLogs } from '../../src/modules/audit/audit.scheduler';

describe('audit.scheduler cleanupOldAuditLogs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes old audit logs and returns count', async () => {
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 5 } as any);

    const count = await cleanupOldAuditLogs();
    expect(prismaMock.auditLog.deleteMany).toHaveBeenCalled();
    expect(count).toBe(5);
  });
});

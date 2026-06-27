import { prismaMock } from '../config/singleton';
import { planningService } from '../../src/modules/planning/planning.service';

describe('Planning Availability', () => {
  const admin = { id: 'admin-1', branchId: 'branch-1' };
  const employee = { id: 'emp-1' };
  const department = { id: 'dept-1' };

  beforeEach(() => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: employee.id,
        name: 'Employee One',
        email: 'emp.avail@test.com',
        branchId: admin.branchId,
        departmentId: department.id,
        branch: { id: admin.branchId, name: 'Test Branch' },
        department: { id: department.id, name: 'Test Dept' },
        skills: [],
      } as any,
    ]);
  });

  it('should return availability status for an employee across multiple days', async () => {
    const from = new Date('2026-05-10T00:00:00Z');
    const to = new Date('2026-05-12T23:59:59Z');

    prismaMock.schedule.findMany.mockResolvedValue([
      {
        id: 'sch-1',
        title: 'Busy Shift',
        startDatetime: new Date('2026-05-11T08:00:00Z'),
        endDatetime: new Date('2026-05-11T16:00:00Z'),
        assignments: [{ userId: employee.id }],
      },
    ] as any);

    prismaMock.absence.findMany.mockResolvedValue([
      {
        id: 'abs-1',
        employeeId: employee.id,
        startDate: new Date('2026-05-12T00:00:00Z'),
        endDate: new Date('2026-05-12T23:59:59Z'),
        status: 'approved',
      },
    ] as any);

    const result = await planningService.getAvailability(
      { from, to, branchId: admin.branchId },
      { id: admin.id, roleName: 'admin', branchId: admin.branchId, departmentId: null, permissions: ['schedules:view'] }
    );

    const empResult = result.find((r: any) => r.userId === employee.id);
    expect(empResult).toBeDefined();
    expect(empResult?.days).toHaveLength(3);

    // 10 Mayo: Disponible
    expect(empResult?.days[0].status).toBe('available');
    // 11 Mayo: Ocupado
    expect(empResult?.days[1].status).toBe('busy');
    // 12 Mayo: Ausencia
    expect(empResult?.days[2].status).toBe('absence');
  });
});
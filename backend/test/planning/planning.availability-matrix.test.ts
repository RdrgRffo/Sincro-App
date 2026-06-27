import { prismaMock } from '../config/singleton';
import { planningService } from '../../src/modules/planning/planning.service';

describe('Planning Availability Matrix', () => {
  const admin = { id: 'admin-1', branchId: 'branch-1' };
  const branch = { id: 'branch-1', name: 'Test Branch Matrix' };
  const department = { id: 'dept-1', name: 'Test Dept Matrix' };
  const employee1 = { id: 'emp-1', name: 'Employee One Matrix' };
  const employee2 = { id: 'emp-2', name: 'Employee Two Matrix' };

  beforeEach(() => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: employee1.id,
        name: employee1.name,
        email: 'emp1.matrix@test.com',
        branchId: branch.id,
        departmentId: department.id,
        branch,
        department,
        skills: [],
      },
      {
        id: employee2.id,
        name: employee2.name,
        email: 'emp2.matrix@test.com',
        branchId: branch.id,
        departmentId: department.id,
        branch,
        department,
        skills: [],
      },
    ] as any);
  });

  it('should return availability matrix for multiple employees across multiple days with correct statuses and schedules', async () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-03T23:59:59Z');

    // Employee 1:
    // June 1: Available
    // June 2: Busy (Shift 1)
    // June 3: Absence
    const shift1 = {
      id: 'sch-1',
      title: 'Shift 1 for Emp1',
      startDatetime: new Date('2026-06-02T08:00:00Z'),
      endDatetime: new Date('2026-06-02T16:00:00Z'),
      assignments: [{ userId: employee1.id }],
    };
    const shift2 = {
      id: 'sch-2',
      title: 'Shift 2 for Emp2',
      startDatetime: new Date('2026-06-01T10:00:00Z'),
      endDatetime: new Date('2026-06-01T18:00:00Z'),
      assignments: [{ userId: employee2.id }],
    };
    const shift3 = {
      id: 'sch-3',
      title: 'Shift 3 for Emp2',
      startDatetime: new Date('2026-06-03T09:00:00Z'),
      endDatetime: new Date('2026-06-03T17:00:00Z'),
      assignments: [{ userId: employee2.id }],
    };
    prismaMock.schedule.findMany.mockResolvedValue([
      {
        id: shift1.id,
        title: shift1.title,
        startDatetime: new Date('2026-06-02T08:00:00Z'),
        endDatetime: new Date('2026-06-02T16:00:00Z'),
        assignments: [{ userId: employee1.id }],
      },
      {
        id: shift2.id,
        title: shift2.title,
        startDatetime: new Date('2026-06-01T10:00:00Z'),
        endDatetime: new Date('2026-06-01T18:00:00Z'),
        assignments: [{ userId: employee2.id }],
      },
      {
        id: shift3.id,
        title: shift3.title,
        startDatetime: new Date('2026-06-03T09:00:00Z'),
        endDatetime: new Date('2026-06-03T17:00:00Z'),
        assignments: [{ userId: employee2.id }],
      },
    ] as any);
    prismaMock.absence.findMany.mockResolvedValue([
      {
        id: 'abs-1',
        employeeId: employee1.id,
        startDate: new Date('2026-06-03T00:00:00Z'),
        endDate: new Date('2026-06-03T23:59:59Z'),
        status: 'approved',
      },
    ] as any);

    const result = await planningService.getAvailabilityMatrix(
      { from, to, branchId: branch.id },
      { id: admin.id, roleName: 'admin', branchId: branch.id, departmentId: null, permissions: ['schedules:view'] }
    );

    expect(result).toBeDefined();
    expect(result.days).toHaveLength(3);
    expect(result.days[0]).toBe('2026-06-01T00:00:00.000Z');
    expect(result.days[1]).toBe('2026-06-02T00:00:00.000Z');
    expect(result.days[2]).toBe('2026-06-03T00:00:00.000Z');
    expect(result.rows).toHaveLength(2); // employee1 and employee2

    const emp1Result = result.rows.find(r => r.id === employee1.id);
    expect(emp1Result).toBeDefined();
    expect(emp1Result?.name).toBe('Employee One Matrix');
    expect(emp1Result?.days).toHaveLength(3);

    // Employee 1 - June 1: Available
    expect(emp1Result?.days[0].status).toBe('available');
    expect(emp1Result?.days[0].schedules).toHaveLength(0);

    // Employee 1 - June 2: Busy (Shift 1)
    expect(emp1Result?.days[1].status).toBe('busy');
    expect(emp1Result?.days[1].schedules).toHaveLength(1);
    expect(emp1Result?.days[1].schedules[0].id).toBe(shift1.id);
    expect(emp1Result?.days[1].schedules[0].title).toBe(shift1.title);

    // Employee 1 - June 3: Absence
    expect(emp1Result?.days[2].status).toBe('absence');
    expect(emp1Result?.days[2].schedules).toHaveLength(0);

    const emp2Result = result.rows.find(r => r.id === employee2.id);
    expect(emp2Result).toBeDefined();
    expect(emp2Result?.name).toBe('Employee Two Matrix');
    expect(emp2Result?.days).toHaveLength(3);

    // Employee 2 - June 1: Busy (Shift 2)
    expect(emp2Result?.days[0].status).toBe('busy');
    expect(emp2Result?.days[0].schedules).toHaveLength(1);
    expect(emp2Result?.days[0].schedules[0].id).toBe(shift2.id);
    expect(emp2Result?.days[0].schedules[0].title).toBe(shift2.title);

    // Employee 2 - June 2: Available
    expect(emp2Result?.days[1].status).toBe('available');
    expect(emp2Result?.days[1].schedules).toHaveLength(0);

    // Employee 2 - June 3: Busy (Shift 3)
    expect(emp2Result?.days[2].status).toBe('busy');
    expect(emp2Result?.days[2].schedules).toHaveLength(1);
    expect(emp2Result?.days[2].schedules[0].id).toBe(shift3.id);
    expect(emp2Result?.days[2].schedules[0].title).toBe(shift3.title);
  });

  it('should filter by department if departmentId is provided', async () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-01T23:59:59Z');

    prismaMock.user.findMany.mockResolvedValue([
      {
        id: employee1.id,
        name: employee1.name,
        email: 'emp1.matrix@test.com',
        branchId: branch.id,
        departmentId: department.id,
        branch,
        department,
        skills: [],
      },
      {
        id: employee2.id,
        name: employee2.name,
        email: 'emp2.matrix@test.com',
        branchId: branch.id,
        departmentId: department.id,
        branch,
        department,
        skills: [],
      },
    ] as any);
    prismaMock.schedule.findMany.mockResolvedValue([]);
    prismaMock.absence.findMany.mockResolvedValue([]);

    const result = await planningService.getAvailabilityMatrix(
      { from, to, branchId: branch.id, departmentId: department.id },
      { id: admin.id, roleName: 'admin', branchId: branch.id, departmentId: null, permissions: ['schedules:view'] }
    );

    expect(result.rows).toHaveLength(2); // Only employee1 and employee2 from 'Test Dept Matrix'
    expect(result.rows.some(r => r.id === employee1.id)).toBe(true);
    expect(result.rows.some(r => r.id === employee2.id)).toBe(true);
    expect(result.rows.every(r => r.department?.id === department.id)).toBe(true);
  });

  it('should filter by branch if branchId is provided', async () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-01T23:59:59Z');

    const otherBranch = { id: 'branch-2', name: 'Other Branch Matrix' };
    const otherDepartment = { id: 'dept-2', name: 'Other Branch Dept Matrix' };
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'emp-4',
        name: 'Employee Four Matrix',
        email: 'emp4.matrix@test.com',
        branchId: otherBranch.id,
        departmentId: otherDepartment.id,
        branch: otherBranch,
        department: otherDepartment,
        skills: [],
      },
    ] as any);
    prismaMock.schedule.findMany.mockResolvedValue([]);
    prismaMock.absence.findMany.mockResolvedValue([]);

    const result = await planningService.getAvailabilityMatrix(
      { from, to, branchId: otherBranch.id },
      { id: admin.id, roleName: 'admin', branchId: branch.id, departmentId: null, permissions: ['schedules:view'] }
    );

    expect(result.rows).toHaveLength(1); // Only employee4 from 'Other Branch Matrix'
    expect(result.rows[0].branch?.id).toBe(otherBranch.id);
  });

  it('does not invoke $queryRaw (equity SQL path is separate from availability matrix)', async () => {
    prismaMock.$queryRaw.mockClear();
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-02T23:59:59Z');
    prismaMock.schedule.findMany.mockResolvedValue([]);
    prismaMock.absence.findMany.mockResolvedValue([]);

    await planningService.getAvailabilityMatrix(
      { from, to, branchId: branch.id },
      { id: admin.id, roleName: 'admin', branchId: branch.id, departmentId: null, permissions: ['schedules:view'] },
    );

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
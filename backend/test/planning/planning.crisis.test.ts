import { planningManager } from '../../src/modules/planning/planning.manager';

const filters = {
  from: new Date('2026-05-12T00:00:00.000Z'),
  to: new Date('2026-05-18T23:59:59.999Z'),
  branchIds: ['branch-1'],
};

const actor = {
  id: 'manager-1',
  roleName: 'general_manager',
  branchId: 'branch-1',
  departmentId: 'department-1',
  permissions: ['schedules:view'],
};

describe('PlanningManager.getCrisisSummary', () => {
  it('includes only today\'s medium and high severity timeline items in today', async () => {
    const coverageSpy = jest.spyOn((planningManager as unknown as { coverage: { listCoverageRisks: jest.Mock } }).coverage, 'listCoverageRisks');
    const equitySpy = jest.spyOn((planningManager as unknown as { equity: { listEquity: jest.Mock; listTimeline: jest.Mock } }).equity, 'listEquity');
    const timelineSpy = jest.spyOn((planningManager as unknown as { equity: { listEquity: jest.Mock; listTimeline: jest.Mock } }).equity, 'listTimeline');

    coverageSpy.mockResolvedValue([] as never);
    equitySpy.mockResolvedValue([] as never);
    timelineSpy.mockResolvedValue([
      { type: 'schedule', at: new Date().toISOString(), title: 'Hoy crítico', severity: 'high' },
      { type: 'schedule', at: new Date('2026-05-27T09:00:00.000Z').toISOString(), title: 'Ayer crítico', severity: 'high' },
      { type: 'schedule', at: new Date().toISOString(), title: 'Hoy normal', severity: 'normal' },
      { type: 'holiday', at: new Date().toISOString(), title: 'Hoy medio', severity: 'medium' },
    ] as never);

    const summary = await planningManager.getCrisisSummary(filters, actor);

    expect(summary.today.map((item) => item.title)).toEqual(['Hoy crítico', 'Hoy medio']);
    expect(summary.highRisks).toEqual([]);
    expect(summary.mediumRisks).toEqual([]);
    expect(summary.overloaded).toEqual([]);
  });
});

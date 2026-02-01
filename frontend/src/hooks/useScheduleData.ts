import { } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import api from '@/config/api';
import type { CalendarBranchHoliday, Department, Schedule, ScheduleAssignment, WeekScheduleItem, WeekSchedulesResponse } from '@/types';

type DateRange = { from: Date; to: Date };

export function useScheduleData(options: {
  activeBranchId: string;
  selectedDeptId: string;
  filterUserId: string;
  shouldUseWeekEndpoint: boolean;
  weekRefDate: Date;
  dateRange: DateRange;
  fetchAllWhenNoBranch?: boolean;
  scheduleId?: string;
  user?: { id: string; role: { name: string } } | null;
}) {
  const { activeBranchId, selectedDeptId, filterUserId, shouldUseWeekEndpoint, weekRefDate, dateRange } = options;
  const fetchAllWhenNoBranch = options.fetchAllWhenNoBranch ?? (options.user?.role?.name === 'admin');

  const departmentsQuery = useQuery({
    queryKey: ['departments', 'schedule-page', activeBranchId],
    queryFn: () => api.get('/departments', { params: { includeInactive: false, branchId: activeBranchId || undefined } }).then((r) => r.data),
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', 'schedule-page'],
    queryFn: () => api.get('/branches', { params: { includeInactive: true } }).then((r) => r.data),
  });

  const departmentList: Department[] = departmentsQuery.data?.data ?? [];
  const availableBranches = branchesQuery.data?.data ?? [];

  const resolvedFilterUserId = filterUserId === 'me' ? (options.user?.id ?? '') : filterUserId;

  const isoWeekYear = getISOWeekYear(weekRefDate);
  const isoWeek = getISOWeek(weekRefDate);

  const mapWeekItemToSchedule = (item: WeekScheduleItem): Schedule => ({
    id: item.id,
    title: item.title,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    type: item.type,
    scheduleTypeId: item.scheduleTypeId,
    color: item.color,
    location: item.location ?? undefined,
    notes: item.notes ?? undefined,
    isLastMinute: item.isLastMinute,
    hoursPerDay: item.hoursPerDay,
    branchId: item.branchId ?? undefined,
    departmentId: item.departmentId ?? undefined,
    department: item.department ?? undefined,
    createdById: 'system',
    createdBy: { id: 'system', name: 'Sistema' },
    createdAt: item.startDatetime,
    updatedAt: item.endDatetime,
    assignments: item.assignees.map<ScheduleAssignment>((assignee) => ({
      scheduleId: item.id,
      userId: assignee.id,
      user: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
        avatarUrl: assignee.avatarUrl,
        department: assignee.department ?? undefined,
        companyPhone: assignee.companyPhone,
        auxiliaryPhone: assignee.auxiliaryPhone,
      },
      assignedAt: item.startDatetime,
    })),
  });

  const schedulesQuery = useQuery({
    queryKey: [
      'schedules',
      activeBranchId || 'all',
      selectedDeptId || 'all',
      resolvedFilterUserId || 'all',
      shouldUseWeekEndpoint ? 'week-view' : 'month-view',
      shouldUseWeekEndpoint ? `${isoWeekYear}-${isoWeek}` : `${dateRange.from.getFullYear()}-${dateRange.from.getMonth()+1}`,
    ],
    queryFn: () => {
      if (shouldUseWeekEndpoint) {
        const weekParams: Record<string, string> = {};
        if (activeBranchId) weekParams.branchId = activeBranchId;
        if (selectedDeptId) weekParams.departmentId = selectedDeptId;
        if (resolvedFilterUserId) weekParams.userId = resolvedFilterUserId;
        return api.get<{ data: WeekSchedulesResponse }>(`/schedules/week/${isoWeekYear}/${isoWeek}`, { params: weekParams }).then((r) => r.data.data.items.map(mapWeekItemToSchedule));
      }

      return api.get<{ data: Schedule[] }>('/schedules', {
        params: {
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(selectedDeptId ? { departmentId: selectedDeptId } : {}),
          ...(resolvedFilterUserId ? { userId: resolvedFilterUserId } : {}),
          from: new Date(dateRange.from.getFullYear(), dateRange.from.getMonth()-1, 1).toISOString(),
          to: new Date(dateRange.to.getFullYear(), dateRange.to.getMonth()+2, 0).toISOString(),
        },
      }).then((r) => r.data.data);
    },
    enabled: Boolean(activeBranchId) || fetchAllWhenNoBranch,
  });

  const branchHolidaysQuery = useQuery({
    queryKey: ['branch-holidays-calendar', activeBranchId || 'all', dateRange.from.toISOString().slice(0,10), dateRange.to.toISOString().slice(0,10)],
    queryFn: () => api.get<{ data: CalendarBranchHoliday[] }>(`/branches/${activeBranchId || 'all'}/holidays`, { params: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString(), ...(activeBranchId ? {} : { groupShared: true }) } }).then((r) => r.data),
    enabled: Boolean(activeBranchId) || fetchAllWhenNoBranch,
  });

  const scheduleDetailQuery = useQuery({
    queryKey: ['schedule-detail', options.scheduleId],
    queryFn: () => api.get<{ data: Schedule }>(`/schedules/${options.scheduleId}`).then((r) => r.data.data),
    enabled: Boolean(options.scheduleId),
  });

  return {
    departmentList,
    availableBranches,
    departmentQuery: departmentsQuery,
    resolvedFilterUserId,
    schedules: schedulesQuery.data ?? null,
    schedulesLoading: schedulesQuery.isLoading,
    branchHolidays: branchHolidaysQuery.data ?? null,
    scheduleDetail: scheduleDetailQuery.data ?? null,
    queries: {
      schedulesQuery,
      branchHolidaysQuery,
      scheduleDetailQuery,
    },
  };
}

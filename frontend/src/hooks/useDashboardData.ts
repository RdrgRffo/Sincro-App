import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import api from '@/config/api';
import type { User, WeekScheduleItem } from '@/types';

export function useDashboardData(user?: User | null) {
  const now = new Date();
  const isoWeek = getISOWeek(now);
  const isoWeekYear = getISOWeekYear(now);

  const weekQueryParams = useMemo(() => {
    const params: Record<string, string> = {};
    const roleName = user?.role?.name;
    if (roleName === 'department_manager' && user?.department?.id) {
      params.departmentId = user.department.id;
    } else if (roleName === 'general_manager' && user?.branchId) {
      params.branchId = user.branchId;
    }
    return params;
  }, [user]);

  const weekSchedulesQuery = useQuery({
    queryKey: ['schedules', 'week', isoWeekYear, isoWeek, weekQueryParams],
    queryFn: () => {
      const searchParams = new URLSearchParams(weekQueryParams);
      const qs = searchParams.toString();
      const url = `/schedules/week/${isoWeekYear}/${isoWeek}${qs ? `?${qs}` : ''}`;
      return api
        .get<{ data: { items: WeekScheduleItem[] } }>(url)
        .then((r) => r.data.data.items);
    },
  });

  const usersCountQuery = useQuery({
    queryKey: ['users', 'count', 'active'],
    queryFn: () => api.get('/users?limit=1&status=active').then((r) => r.data.pagination?.total || 0),
    enabled: user?.role?.name === 'admin' || user?.role?.name === 'general_manager' || user?.role?.name === 'department_manager',
  });

  const alertsQuery = useQuery({
    queryKey: ['schedules', 'alerts'],
    queryFn: () =>
      api.get<{ data: Array<{ type: 'unassigned' | 'solo'; scheduleId: string; title: string; date: string; assigneeName?: string }> }>('/schedules/alerts')
        .then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const weekSchedules = weekSchedulesQuery.data;
  const weekSchedulesList = useMemo(() => weekSchedules ?? [], [weekSchedules]);
  const mySchedules = useMemo(
    () => weekSchedulesList.filter((schedule) => schedule.assignees?.some((assignee) => assignee.id === user?.id)),
    [weekSchedulesList, user?.id],
  );

  const lastMinuteCount = weekSchedulesList.filter((schedule) => schedule.isLastMinute).length;

  return {
    now,
    isoWeek,
    isoWeekYear,
    weekQueryParams,
    weekSchedules,
    loadingSchedules: weekSchedulesQuery.isLoading,
    usersData: usersCountQuery.data,
    loadingUsers: usersCountQuery.isLoading,
    alerts: alertsQuery.data,
    totalAlerts: alertsQuery.data?.length || 0,
    mySchedules,
    lastMinuteCount,
  };
}

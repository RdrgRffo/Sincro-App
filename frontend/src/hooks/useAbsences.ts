import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import type {
  AbsenceRequest,
  PaginatedAbsences,
  AbsenceCalendarResponse,
  AbsenceStatus,
  AbsenceKind,
} from '@/types';

export const absenceKeys = {
  all: ['absences'] as const,
  list: (filters: Record<string, unknown>) => ['absences', 'list', filters] as const,
  calendar: (year: number, week: number, filters: Record<string, unknown>) =>
    ['absences', 'calendar', year, week, filters] as const,
  detail: (id: string) => ['absences', 'detail', id] as const,
};

export interface AbsenceListFilters {
  status?: AbsenceStatus;
  employeeId?: string;
  branchId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface AbsenceCalendarFilters {
  branchId?: string;
  departmentId?: string;
  employeeId?: string;
}

export function useAbsencesList(filters: AbsenceListFilters) {
  return useQuery<PaginatedAbsences>({
    queryKey: absenceKeys.list(filters as unknown as Record<string, unknown>),
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (filters.status) params.status = filters.status;
      if (filters.employeeId) params.employeeId = filters.employeeId;
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.page) params.page = filters.page;
      if (filters.pageSize) params.pageSize = filters.pageSize;
      if (filters.search) params.search = filters.search;

      const res = await api.get<{ data: PaginatedAbsences }>('/absences', { params });
      return res.data.data;
    },
  });
}

export function useAbsenceCalendar(
  year: number,
  week: number,
  filters: AbsenceCalendarFilters,
  enabled = true,
) {
  return useQuery<AbsenceCalendarResponse>({
    queryKey: absenceKeys.calendar(year, week, filters as unknown as Record<string, unknown>),
    queryFn: async () => {
      const params: Record<string, unknown> = { year, week };
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.employeeId) params.employeeId = filters.employeeId;

      const res = await api.get<{ data: AbsenceCalendarResponse }>('/absences/calendar', { params });
      return res.data.data;
    },
    enabled,
  });
}

export function useAbsenceCalendarRange(
  from: Date,
  to: Date,
  filters: AbsenceCalendarFilters,
  enabled = true,
) {
  return useQuery<AbsenceCalendarResponse>({
    queryKey: ['absences', 'calendar-range', from.toISOString(), to.toISOString(), filters],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        from: from.toISOString(),
        to: to.toISOString(),
      };
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.employeeId) params.employeeId = filters.employeeId;

      const res = await api.get<{ data: AbsenceCalendarResponse }>('/absences/calendar', { params });
      return res.data.data;
    },
    enabled,
  });
}

export function useAbsenceById(id: string | undefined) {
  return useQuery<AbsenceRequest>({
    queryKey: absenceKeys.detail(id!),
    queryFn: async () => {
      const res = await api.get<{ data: AbsenceRequest }>(`/absences/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      startDate: string;
      endDate: string;
      type: AbsenceKind;
      note?: string;
      /** Omitir = solicitud para el usuario autenticado. Solo gestores con alcance. */
      employeeId?: string;
    }) => {
      const res = await api.post<{
        data: AbsenceRequest & {
          hasOverlap: boolean;
          overlappingEmployees: Array<{ id: string; name: string; email: string }>;
        };
      }>('/absences', data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: absenceKeys.all });
    },
  });
}

export function useApproveAbsence() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await api.patch<{ data: AbsenceRequest }>(`/absences/${id}/approve`, { note });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: absenceKeys.all });
    },
  });
}

export function useRejectAbsence() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const res = await api.patch<{ data: AbsenceRequest }>(`/absences/${id}/reject`, { rejectionReason });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: absenceKeys.all });
    },
  });
}

export function useCancelAbsence() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ data: AbsenceRequest }>(`/absences/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: absenceKeys.all });
    },
  });
}

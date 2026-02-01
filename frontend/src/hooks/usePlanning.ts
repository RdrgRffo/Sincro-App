import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import type { Branch, Department } from '@/types';

export type PlanningFilters = {
  from: Date;
  to: Date;
  branchId?: string;
  departmentId?: string;
};

export type PlanningSkill = {
  id: string;
  name: string;
  category: string | null;
  color: string;
};

export type PlanningStatus = 'available' | 'busy' | 'absence';

export type CoverageRiskItem = {
  severity: 'high' | 'medium' | 'low';
  reasons: string[];
  schedule: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
    branch: { id: string; name: string } | null;
  };
};

export type AvailabilityItem = {
  userId: string;
  userName: string;
  email?: string;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  skills?: PlanningSkill[];
  status?: PlanningStatus;
  schedulesCount?: number;
  absencesCount?: number;
  days: Array<{ date: string; status: PlanningStatus }>;
};

export type AvailabilityMatrix = {
  days: string[];
  rows: Array<{
    id: string;
    name: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
    skills: PlanningSkill[];
    days: Array<{
      date: string;
      status: PlanningStatus;
      schedules: Array<{ id: string; title: string }>;
      absenceIds?: string[];
    }>;
  }>;
};

export type SubstituteSuggestion = {
  id: string;
  name: string;
  email: string;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  skills: PlanningSkill[];
  matchedSkills: PlanningSkill[];
  score: number;
  equity: {
    hours: number;
    weekends: number;
    urgent: number;
    overtimeEstimate: number;
  };
  reasons: string[];
};

export type EquityItem = {
  id: string;
  name: string;
  totalHours: number;
  overtimeEstimate: number;
  weekendShifts: number;
  urgentShifts: number;
  approvedAbsences: number;
  rejectedAbsences: number;
};

export type TimelineItem = {
  type: 'holiday' | 'absence' | 'schedule';
  at: string;
  title: string;
  severity: 'info' | 'normal' | 'medium' | 'high';
};

export type TemplatePreviewDay = {
  date: string;
  minCoverage: number;
  status: 'covered' | 'partial' | 'uncovered';
  recommended: Array<{ id: string; name: string; matchedSkills: PlanningSkill[]; score: number }>;
  backups: Array<{ id: string; name: string; matchedSkills: PlanningSkill[]; score: number }>;
};

export type NotificationPreferences = {
  scheduleChanges: boolean;
  absenceUpdates: boolean;
  departmentAbsenceRequests: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  criticalAlertsOnly: boolean;
};

export type AbsenceImpact = {
  employee: {
    id: string;
    name: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  };
  overlappingAbsences: Array<{
    id: string;
    status: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    employee: { id: string; name: string };
  }>;
  assignedSchedules: Array<{ id: string; title: string; startDatetime: string; endDatetime: string }>;
  holidays: Array<{ id: string; name: string; date: string }>;
  likelihood: 'high' | 'medium' | 'low';
  summary: string;
};

export type PlanningComment = {
  id: string;
  entityType: string;
  entityId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

export const planningKeys = {
  all: ['planning'] as const,
  list: (name: string, filters: Record<string, unknown>) => [...planningKeys.all, name, filters] as const,
  preferences: () => [...planningKeys.all, 'notification-preferences'] as const,
  lookups: () => [...planningKeys.all, 'lookups'] as const,
};

export function planningParams(filters: PlanningFilters) {
  return {
    from: filters.from.toISOString(),
    to: filters.to.toISOString(),
    branchId: filters.branchId || undefined,
    departmentId: filters.departmentId || undefined,
  };
}

function usePlanningQuery<T>(name: string, path: string, filters: PlanningFilters, params?: Record<string, unknown>) {
  const baseParams = planningParams(filters);

  return useQuery<T>({
    queryKey: planningKeys.list(name, { ...baseParams, ...params }),
    queryFn: async () => {
      const response = await api.get<{ data: T }>(path, { params: { ...baseParams, ...params } });
      return response.data.data;
    },
  });
}

export function useCoverageRisks(filters: PlanningFilters) {
  return usePlanningQuery<CoverageRiskItem[]>('coverage-risks', '/planning/coverage-risks', filters);
}

export function useAvailabilityMatrix(filters: PlanningFilters) {
  return usePlanningQuery<AvailabilityMatrix>('availability-matrix', '/planning/availability-matrix', filters);
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: planningKeys.preferences(),
    queryFn: async () => {
      const response = await api.get<{ data: NotificationPreferences }>('/planning/notification-preferences');
      return response.data.data;
    },
  });
}

export function usePlanningLookups(branchId?: string) {
  return useQuery<{ branches: Branch[]; departments: Department[]; skills: PlanningSkill[] }>({
    queryKey: [...planningKeys.lookups(), branchId],
    queryFn: async () => {
      const [branches, departments, skills] = await Promise.all([
        api.get<{ data: Branch[] }>('/branches', { params: { includeInactive: true } }),
        api.get<{ data: Department[] }>('/departments', { params: { includeInactive: false, branchId: branchId || undefined } }),
        api.get<{ data: PlanningSkill[] }>('/skills'),
      ]);

      return {
        branches: branches.data.data,
        departments: departments.data.data,
        skills: skills.data.data,
      };
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<NotificationPreferences>) => {
      const response = await api.patch<{ data: NotificationPreferences }>('/planning/notification-preferences', patch);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.preferences() });
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export interface TeamWeeklySummaryItem {
  userId: string;
  userName: string;
  totalHours: number;
  baseHours: number;
  overtimeHours: number;
  dailyBreakdown: Record<string, number>;
}

interface TeamWeeklySummaryFilters {
  branchId?: string;
  departmentId?: string;
}

/**
 * Hook para obtener los resúmenes semanales de todo un equipo.
 * Solo disponible para admin, general_manager y department_manager.
 */
export function useTeamWeeklySummaries(
  year: number,
  week: number,
  filters?: TeamWeeklySummaryFilters,
) {
  return useQuery({
    queryKey: ['team-weekly-summary', year, week, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.branchId) params.set('branchId', filters.branchId);
      if (filters?.departmentId) params.set('departmentId', filters.departmentId);

      const queryString = params.toString();
      const url = `/schedules/team-weekly-summary/${year}/${week}${queryString ? `?${queryString}` : ''}`;

      const response = await api.get(url);
      // API responses use the envelope { success: true, data: ... }.
      // For paginated endpoints the `data` field itself contains { data: [...], pagination: {...} }.
      const envelope = response.data;
      const payload = envelope?.data;

      if (Array.isArray(payload)) return payload as TeamWeeklySummaryItem[];
      const payloadData = payload as { data?: unknown } | null;
      if (payloadData && Array.isArray(payloadData.data)) return payloadData.data as TeamWeeklySummaryItem[];

      // Fallback: return payload as-is (may be undefined/null)
      return payload as TeamWeeklySummaryItem[] | undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

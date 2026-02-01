import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export interface WeeklySummary {
  userId: string;
  year: number;
  week: number;
  totalHours: number;
  baseHours: number;
  overtimeHours: number;
  dailyBreakdown: Record<string, number>;
}

/**
 * Hook para obtener el resumen semanal de horas del usuario autenticado.
 * Disponible para todos los roles (employee, department_manager, etc.).
 */
export function useMyWeeklySummary(year: number, week: number) {
  return useQuery({
    queryKey: ['my-weekly-summary', year, week],
    queryFn: async () => {
      const response = await api.get<{ data: WeeklySummary }>(
        `/schedules/my-weekly-summary/${year}/${week}`,
      );
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useBranchesHolidays(branchId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['branch-holidays', branchId, from, to],
    queryFn: () => api.get(`/branches/${branchId}/holidays`, { params: { from, to } }).then((r) => r.data),
  });
}

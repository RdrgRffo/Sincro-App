import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useAuditLog(params: { page?: number; limit?: number } = { page: 1, limit: 20 }) {
  const { page = 1, limit = 20 } = params;
  return useQuery({
    queryKey: ['audit', page, limit],
    queryFn: () => api.get('/audit', { params: { page, limit } }).then((r) => r.data),
  });
}

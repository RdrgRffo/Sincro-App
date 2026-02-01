import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useBranches(includeInactive = false) {
  return useQuery({
    queryKey: ['branches', includeInactive],
    queryFn: () => api.get('/branches', { params: { includeInactive } }).then((r) => r.data),
  });
}

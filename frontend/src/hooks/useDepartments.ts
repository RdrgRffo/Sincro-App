import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useDepartments(branchId?: string, includeInactive = false) {
  return useQuery({
    queryKey: ['departments', branchId, includeInactive],
    queryFn: () => api.get('/departments', { params: { includeInactive, branchId } }).then((r) => r.data),
  });
}

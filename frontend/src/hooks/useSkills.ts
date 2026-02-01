import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => api.get('/skills').then((r) => r.data.data),
  });
}

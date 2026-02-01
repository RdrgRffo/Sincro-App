import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/webhooks').then((r) => r.data.data),
  });
}

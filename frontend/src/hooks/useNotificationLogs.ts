import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useNotificationLogs(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['notificationLogs', page, limit],
    queryFn: () => api.get('/notifications/logs', { params: { page, limit } }).then((r) => r.data),
  });
}

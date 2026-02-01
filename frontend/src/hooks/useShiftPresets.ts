import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useShiftPresets() {
  return useQuery({
    queryKey: ['shift-presets'],
    queryFn: () => api.get('/shift-presets').then((r) => r.data.data),
  });
}

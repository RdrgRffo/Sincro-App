import { apiClient } from '@/lib/api-client';
import type { ScheduleType } from '@/types';

// Extendemos el tipo para incluir campos de base de datos si no están en el global
export interface FullScheduleType extends ScheduleType {
  name: string;
  id: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateScheduleTypeInput = Omit<FullScheduleType, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> & { isActive?: boolean };

export const scheduleTypesApi = {
  getAll: () => 
    apiClient.get('/schedule-types').then((res) => res.data.data as FullScheduleType[]),
  
  create: (data: CreateScheduleTypeInput) => 
    apiClient.post('/schedule-types', data).then((res) => res.data.data as FullScheduleType),
  
  update: (id: string, data: Partial<CreateScheduleTypeInput>) => 
    apiClient.put(`/schedule-types/${id}`, data).then((res) => res.data.data as FullScheduleType),
  
  delete: (id: string) => apiClient.delete(`/schedule-types/${id}`).then((res) => res.data),
};
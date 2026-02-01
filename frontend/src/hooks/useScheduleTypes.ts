import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { scheduleTypesApi } from '@/components/schedule/scheduleTypesApi';
import type { CreateScheduleTypeInput, FullScheduleType } from '@/components/schedule/scheduleTypesApi';

export function useScheduleTypes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['schedule-types'],
    queryFn: scheduleTypesApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createMutation = useMutation<FullScheduleType, Error, CreateScheduleTypeInput>({
    mutationFn: scheduleTypesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-types'] });
      toast.success('Tipo de evento creado correctamente');
    },
    onError: () => toast.error('Error al crear el tipo de evento'),
  });

  const updateMutation = useMutation<FullScheduleType, Error, { id: string; data: Partial<CreateScheduleTypeInput> }>({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateScheduleTypeInput> }) => scheduleTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-types'] });
      toast.success('Tipo de evento actualizado');
    },
    onError: () => toast.error('Error al actualizar el tipo de evento'),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: scheduleTypesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-types'] });
      toast.success('Tipo de evento eliminado');
    },
  });

  return { ...query, types: (query.data || []) as FullScheduleType[], createMutation, updateMutation, deleteMutation };
}
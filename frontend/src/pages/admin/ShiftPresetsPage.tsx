import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Clock, RotateCcw } from 'lucide-react';
import api from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import { DataTable } from '@/components/common/DataTable';
import { TableSkeleton } from '@/components/common/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getApiErrorMessage } from '@/lib/apiError';
import toast from 'react-hot-toast';

interface ShiftPreset {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ShiftPresetFormData {
  name: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

export default function ShiftPresetsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role?.name === 'admin';
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ShiftPreset | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState<ShiftPreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShiftPreset | null>(null);

  const { data: presets, isLoading } = useQuery<ShiftPreset[]>({
    queryKey: ['shift-presets', showInactive],
    queryFn: async () => {
      const { data } = await api.get('/shift-presets', { params: { includeInactive: showInactive || undefined } });
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: ShiftPresetFormData) => {
      const { data } = await api.post('/shift-presets', formData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-presets'] });
      toast.success('Turno predefinido creado');
      closeModal();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Error al crear turno predefinido');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<ShiftPresetFormData> }) => {
      const { data } = await api.patch(`/shift-presets/${id}`, formData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-presets'] });
      toast.success('Turno predefinido actualizado');
      closeModal();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Error al actualizar turno predefinido');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/shift-presets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-presets'] });
      toast.success('Turno predefinido desactivado');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Error al desactivar turno predefinido');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/shift-presets/${id}/reactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-presets'] });
      toast.success('Turno predefinido reactivado');
      setReactivateTarget(null);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, 'No se pudo reactivar el turno predefinido'));
      setReactivateTarget(null);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: ShiftPresetFormData = {
      name: formData.get('name') as string,
      startTime: formData.get('startTime') as string,
      endTime: formData.get('endTime') as string,
    };

    if (editingPreset) {
      updateMutation.mutate({ id: editingPreset.id, formData: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openCreateModal = () => {
    setEditingPreset(null);
    setIsModalOpen(true);
  };

  const openEditModal = (preset: ShiftPreset) => {
    setEditingPreset(preset);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPreset(null);
  };

  const handleDelete = (preset: ShiftPreset) => {
    // Open confirm dialog instead of using window.confirm
    setDeleteTarget(preset);
  };

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Turnos Predefinidos</h1>
        <div className="flex items-center gap-3">
          <label className="text-xs text-theme-muted flex items-center gap-2 rounded-lg border border-theme-color px-2.5 py-1.5 bg-theme-surface-muted/30">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-theme-color" />
            Mostrar inactivos
          </label>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-900 transition"
            >
              <Plus size={18} /> Nuevo Turno
            </button>
          )}
        </div>
      </div>

      <DataTable
        data={Array.isArray(presets) ? presets : []}
        rowKey={(p) => p.id}
        columns={[
          {
            key: 'name',
            label: 'Nombre',
            render: (p) => (
              <span className="font-medium">
                {p.name}
              </span>
            ),

          },
          {
            key: 'startTime',
            label: 'Inicio',
            render: (p) => (
              <span className="inline-flex items-center gap-1 text-sm font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                <Clock size={14} /> {p.startTime}
              </span>
            ),
          },
          {
            key: 'endTime',
            label: 'Fin',
            render: (p) => (
              <span className="inline-flex items-center gap-1 text-sm font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">
                <Clock size={14} /> {p.endTime}
              </span>
            ),
          },
          {
            key: 'isActive',
            label: 'Estado',
            render: (p) => (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  p.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.isActive ? 'Activo' : 'Inactivo'}
              </span>
            ),
          },
        ]}
        renderActions={isAdmin ? (p) => (
          <div className="flex justify-end gap-1">
            <button
              onClick={() => openEditModal(p)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
            {p.isActive ? (
              <button
                onClick={() => handleDelete(p)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
                title="Desactivar"
              >
                <Trash2 size={16} />
              </button>
            ) : (
              <button
                onClick={() => setReactivateTarget(p)}
                className="p-2 text-green-600 hover:bg-green-50 rounded"
                title="Reactivar"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        ) : undefined}
        emptyTitle="Sin turnos predefinidos"
        emptyDescription="Crea el primer turno predefinido"
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">
              {editingPreset ? 'Editar' : 'Nuevo'} Turno Predefinido
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  name="name"
                  defaultValue={editingPreset?.name}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Ej: Turno Mañana"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hora de inicio</label>
                <input
                  type="time"
                  name="startTime"
                  defaultValue={editingPreset?.startTime || '09:00'}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hora de fin</label>
                <input
                  type="time"
                  name="endTime"
                  defaultValue={editingPreset?.endTime || '17:00'}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={reactivateTarget !== null}
        title="Reactivar turno predefinido"
        description={`¿Quieres reactivar "${reactivateTarget?.name}"?`}
        confirmLabel="Reactivar"
        variant="warning"
        loading={reactivateMutation.isPending}
        onConfirm={() => reactivateTarget && reactivateMutation.mutate(reactivateTarget.id)}
        onCancel={() => setReactivateTarget(null)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Desactivar turno predefinido"
        description={`¿Quieres desactivar "${deleteTarget?.name}"?`}
        confirmLabel="Desactivar"
        variant="warning"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

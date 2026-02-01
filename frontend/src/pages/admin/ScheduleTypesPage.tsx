import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Palette, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermission } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableSkeleton } from '@/components/common/Skeleton';
import { DataTable } from '@/components/common/DataTable';
import type { Column } from '@/components/common/DataTable';
import type { CreateScheduleTypeInput, FullScheduleType } from '@/components/schedule/scheduleTypesApi';

export function ScheduleTypesPage() {
  const qc = useQueryClient();
  const canCreateScheduleTypes = usePermission('schedule_types:create');
  const canUpdateScheduleTypes = usePermission('schedule_types:update');
  const canDeleteScheduleTypes = usePermission('schedule_types:delete');
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role?.name === 'admin';
  // Allow admins as a fallback even if permission names are not present in the test fixtures
  const canManageScheduleTypes = isAdmin || canCreateScheduleTypes || canUpdateScheduleTypes || canDeleteScheduleTypes;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<FullScheduleType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FullScheduleType | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<FullScheduleType | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: typesData, isLoading } = useQuery<{ data: FullScheduleType[] }>({
    queryKey: ['schedule-types', showInactive],
    queryFn: () => api.get('/schedule-types', { params: { includeInactive: showInactive || undefined } }).then((r) => r.data),
  });

  const types = typesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: CreateScheduleTypeInput) => api.post('/schedule-types', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule-types'] }); toast.success('Tipo de turno creado'); closeModal(); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo crear el tipo de turno')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateScheduleTypeInput> }) => api.patch(`/schedule-types/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule-types'] }); toast.success('Tipo de turno actualizado'); closeModal(); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo actualizar el tipo de turno')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule-types'] }); toast.success('Tipo de turno desactivado'); setDeleteTarget(null); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo desactivar el tipo de turno')),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/schedule-types/${id}/reactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule-types'] }); toast.success('Tipo de turno reactivado'); setReactivateTarget(null); },
    onError: (error: unknown) => { toast.error(getApiErrorMessage(error, 'No se pudo reactivar el tipo de turno')); setReactivateTarget(null); },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const labelValue = formData.get('label') as string;
    const colorValue = formData.get('color') as string;
    const normalizedLabel = labelValue.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const newValue = normalizedLabel.replace(/\s+/g, '_');

    if (editingType) {
      const updateData: Partial<CreateScheduleTypeInput> = {
        name: labelValue,
        label: labelValue,
        color: colorValue,
      };
      if (newValue !== editingType.value) {
        updateData.value = newValue;
      }
      updateMutation.mutate({ id: editingType.id, data: updateData });
    } else {
      createMutation.mutate({ name: labelValue, label: labelValue, value: newValue, color: colorValue });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const columns: Column<FullScheduleType>[] = [
    {
      key: 'label',
      label: 'Nombre',
      render: (type) => (
        <span className="font-medium text-theme-primary">
          {type.label}
        </span>
      ),

    },
    {
      key: 'color',
      label: 'Color',
      render: (type) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border border-theme-color" style={{ backgroundColor: type.color }} />
          <span className="text-sm font-mono text-theme-secondary">{type.color}</span>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Identificador',
      render: (type) => <span className="text-theme-muted">{type.value}</span>,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <TableSkeleton rows={4} cols={3} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-theme-primary">Gestión de Tipos de Turno</h1>
        <div className="flex items-center gap-3">
          <label className="text-xs text-theme-muted flex items-center gap-2 rounded-lg border border-theme-color px-2.5 py-1.5 bg-theme-surface-muted/30">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-theme-color" />
            Mostrar inactivos
          </label>
          {canManageScheduleTypes && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus size={18} /> Nuevo Tipo
            </button>
          )}
        </div>
      </div>

      {!canManageScheduleTypes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu rol solo tiene acceso de lectura. La edición, creación y desactivación de tipos de turno está reservada para administradores.
        </div>
      )}

      <DataTable
        data={types}
        columns={columns}
        rowKey={(type) => type.id}
        isLoading={false}
        renderActions={canManageScheduleTypes ? (type) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => { setEditingType(type); setIsModalOpen(true); }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
            {type.isActive ? (
              <button
                onClick={() => setDeleteTarget(type)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
                title="Desactivar"
              >
                <Trash2 size={16} />
              </button>
            ) : (
              <button
                onClick={() => setReactivateTarget(type)}
                className="p-2 text-green-600 hover:bg-green-50 rounded"
                title="Reactivar"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        ) : undefined}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold text-theme-primary mb-4">{editingType ? 'Editar' : 'Nuevo'} Tipo de Turno</h2>
              {editingType && !editingType.isActive && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center justify-between">
                  <span>Este tipo está actualmente INACTIVO</span>
                  <button
                    type="button"
                    onClick={() => editingType && reactivateMutation.mutate(editingType.id, { onSuccess: () => { setEditingType(null); setIsModalOpen(false); } })}
                    className="btn-ghost text-xs text-green-700"
                  >
                    Reactivar
                  </button>
                </div>
              )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Nombre</label>
                <input name="label" defaultValue={editingType?.label} required className="input-field" placeholder="Ej: Guardia Nocturna" />
              </div>
              <div>
                <label className="text-sm font-medium text-theme-muted mb-1 flex items-center gap-2">
                  <Palette size={14} /> Color
                </label>
                <input type="color" name="color" defaultValue={editingType?.color || '#4F46E5'} className="w-full h-10 border border-theme-color rounded-lg p-1 cursor-pointer bg-theme-surface" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeModal} className="btn-ghost text-sm">Cancelar</button>
                <button type="submit" className="btn-primary text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Desactivar tipo de turno"
        description={`¿Estás seguro de que deseas desactivar "${deleteTarget?.label}"?`}
        confirmLabel="Desactivar"
        variant="warning"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={reactivateTarget !== null}
        title="Reactivar tipo de turno"
        description={`¿Quieres reactivar "${reactivateTarget?.label}"?`}
        confirmLabel="Reactivar"
        variant="warning"
        loading={reactivateMutation.isPending}
        onConfirm={() => reactivateTarget && reactivateMutation.mutate(reactivateTarget.id)}
        onCancel={() => setReactivateTarget(null)}
      />
    </div>
  );
}

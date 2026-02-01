import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { Plus, Webhook, Trash2, Edit, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/config/api';
import type { Branch, Department, WebhookConfig } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ListPageSkeleton } from '@/components/common/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { webhookFormSchema } from '@/pages/admin/webhooks.schema';
import { usePermission } from '@/hooks/usePermissions';

type FormData = z.infer<typeof webhookFormSchema>;
type FormDataInput = z.input<typeof webhookFormSchema>;

function getWebhookScope(wh: WebhookConfig): { type: number; label: string } {
  if (!wh.departmentId && !wh.branchId) {
    return { type: 0, label: 'General' };
  }
  if (wh.departmentId && !wh.branchId) {
    return { type: 1, label: `Departamento: ${wh.department?.name ?? wh.departmentId}` };
  }
  if (!wh.departmentId && wh.branchId) {
    return { type: 2, label: `Sucursal: ${wh.branch?.name ?? wh.branchId}` };
  }
  return { type: 3, label: `${wh.department?.name ?? wh.departmentId} en ${wh.branch?.name ?? wh.branchId}` };
}

function WebhookForm({ webhook, onClose }: { webhook?: WebhookConfig; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormDataInput, unknown, FormData>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: webhook
      ? {
          ...webhook,
          departmentId: webhook.departmentId ?? '',
          branchId: webhook.branchId ?? '',
        }
      : {
          enabled: true,
          notifyModifications: true,
          notifyLastMinute: true,
          fridayReminderEnabled: true,
          mondayAbsenceReminderEnabled: true,
          fridayReminderTime: '12:00',
          departmentId: '',
          branchId: '',
        },
  });

  const branchesData = useQuery<Branch[]>({
    queryKey: ['branches', 'webhooks-form'],
    queryFn: () => api.get<{ data: Branch[] }>('/branches', { params: { includeInactive: true } }).then((r) => r.data.data),
    enabled: true,
  });

  const selectedBranchId = useWatch({ control, name: 'branchId', defaultValue: '' }) ?? '';
  const branchIdTrimmed = String(selectedBranchId).trim();
  /** Webhook antiguo solo con departamento (sin sucursal): permitir listado global al editar. */
  const isLegacyDeptOnlyEdit = Boolean(webhook?.departmentId && !webhook?.branchId);
  const departmentsQueryEnabled = Boolean(branchIdTrimmed) || isLegacyDeptOnlyEdit;

  const prevBranchRef = useRef<string | undefined>(undefined);
  const branchHydratedRef = useRef(false);
  useEffect(() => {
    if (!branchHydratedRef.current) {
      branchHydratedRef.current = true;
      prevBranchRef.current = selectedBranchId;
      return;
    }
    if (prevBranchRef.current !== selectedBranchId) {
      setValue('departmentId', '');
      prevBranchRef.current = selectedBranchId;
    }
  }, [selectedBranchId, setValue]);

  const departmentsData = useQuery<Department[]>({
    queryKey: ['departments', 'webhooks-form', branchIdTrimmed || (isLegacyDeptOnlyEdit ? 'all' : 'none')],
    queryFn: () =>
      api
        .get<{ data: Department[] }>('/departments', {
          params: {
            includeInactive: false,
            ...(branchIdTrimmed ? { branchId: branchIdTrimmed } : {}),
          },
        })
        .then((r) => r.data.data),
    enabled: departmentsQueryEnabled,
    staleTime: 0,
    gcTime: 0,
    placeholderData: undefined,
  });

  const branches = useMemo(() => branchesData.data ?? [], [branchesData.data]);
  const departments = useMemo(() => {
    if (!departmentsQueryEnabled) return [];
    return departmentsData.data ?? [];
  }, [departmentsQueryEnabled, departmentsData.data]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ...data,
        departmentId: data.departmentId || undefined,
        branchId: data.branchId || undefined,
      };
      return webhook ? api.patch(`/webhooks/${webhook.id}`, payload) : api.post('/webhooks', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success(webhook ? 'Webhook actualizado' : 'Webhook creado');
      onClose();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-theme-color shrink-0">
          <h2 className="text-lg font-semibold text-theme-primary">{webhook ? 'Editar Webhook' : 'Nuevo Webhook'}</h2>
          <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col overflow-hidden">
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Nombre *</label>
            <input {...register('name')} className="input-field" placeholder="Canal de Teams - Guardias" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">URL del Webhook *</label>
            <input
              {...register('webhookUrl')}
              className="input-field"
              placeholder="https://outlook.office.com/webhook/..."
            />
            {errors.webhookUrl && <p className="text-xs text-red-500 mt-1">{errors.webhookUrl.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Alcance</label>
            <p className="text-xs text-theme-muted mb-3">
              Elige primero la sucursal: el listado de departamentos se recarga solo con los de esa sede. Opcional: deja departamento vacío para notificar a toda la sucursal.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Sucursal (Opcional)</label>
                <select {...register('branchId')} className="input-field">
                  <option value="">General - Todas las sucursales</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Departamento (Opcional)</label>
                <select
                  key={`dept-${branchIdTrimmed || 'none'}-${isLegacyDeptOnlyEdit ? 'legacy' : 'std'}`}
                  {...register('departmentId')}
                  className="input-field"
                  disabled={
                    (!branchIdTrimmed && !isLegacyDeptOnlyEdit) ||
                    departmentsData.isFetching ||
                    departmentsData.isPending
                  }
                >
                  <option value="">
                    {!branchIdTrimmed && !isLegacyDeptOnlyEdit
                      ? '— Primero selecciona una sucursal —'
                      : 'Toda la sucursal (sin filtrar por departamento)'}
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {branchIdTrimmed && departmentsData.isFetching ? (
                  <p className="text-xs text-theme-muted mt-1">Cargando departamentos de esta sucursal…</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input {...register('fridayReminderEnabled')} type="checkbox" id="fri" className="rounded border-theme-color text-theme-primary" />
              <label htmlFor="fri" className="text-sm text-theme-muted">Resumen viernes</label>
            </div>
            <div>
              <input {...register('fridayReminderTime')} type="time" className="input-field text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {[
              { name: 'notifyModifications' as const, label: 'Notificar modificaciones de guardias' },
              { name: 'notifyLastMinute' as const, label: 'Notificar cambios de último momento (<24h)' },
              { name: 'mondayAbsenceReminderEnabled' as const, label: 'Resumen ausencias (lunes)' },
              { name: 'enabled' as const, label: 'Webhook activo' },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <input {...register(item.name)} type="checkbox" id={item.name} className="rounded border-theme-color text-theme-primary" />
                <label htmlFor={item.name} className="text-sm text-theme-muted">{item.label}</label>
              </div>
            ))}
          </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 p-5 sm:p-7 pt-3 sm:pt-4 border-t border-theme-color bg-theme-surface shrink-0">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost text-sm">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {mutation.isPending && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
              {webhook ? 'Guardar' : 'Crear Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WebhooksPage() {
  const qc = useQueryClient();
  const canManageWebhooks = usePermission('webhooks:manage');
  const [formWebhook, setFormWebhook] = useState<WebhookConfig | null | false>(false);
  const [deleteConfirm, setDeleteConfirm] = useState<WebhookConfig | null>(null);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get<{ data: WebhookConfig[] }>('/webhooks').then((r: AxiosResponse<{ data: WebhookConfig[] }>) => r.data.data),
  });

  const sortedWebhooks = useMemo(() => {
    if (!webhooks) return [];
    return [...webhooks].sort((a, b) => {
      const aScope = getWebhookScope(a);
      const bScope = getWebhookScope(b);
      if (aScope.type !== bScope.type) return aScope.type - bScope.type;
      if (aScope.label !== bScope.label) return aScope.label.localeCompare(bScope.label);
      return a.name.localeCompare(b.name);
    });
  }, [webhooks]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook eliminado'); setDeleteConfirm(null); },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`),
    onSuccess: () => toast.success('Mensaje de prueba enviado'),
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error al enviar prueba')),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Webhooks Microsoft Teams</h1>
          <p className="text-sm text-theme-muted mt-0.5">Configura notificaciones automáticas para canales de Teams</p>
        </div>
        {canManageWebhooks ? (
          <button type="button" onClick={() => setFormWebhook(null)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />Nuevo Webhook
          </button>
        ) : null}
      </div>

      {!canManageWebhooks ? (
        <p className="text-xs text-theme-muted rounded-lg border border-theme-color bg-theme-surface-muted px-3 py-2">
          Tu rol puede consultar la configuración. Crear, editar, probar o eliminar webhooks requiere permiso de administración.
        </p>
      ) : null}

      {isLoading ? (
        <ListPageSkeleton />
      ) : !webhooks?.length ? (
        <div className="card">
          <EmptyState
            icon={Webhook}
            title="Sin webhooks configurados"
            description="Añade un webhook de Microsoft Teams para recibir notificaciones automáticas"
            action={
              canManageWebhooks ? (
                <button type="button" onClick={() => setFormWebhook(null)} className="btn-primary text-sm">
                  Añadir webhook
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sortedWebhooks.map((wh: WebhookConfig) => (
            <div key={wh.id} className="card p-7 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${wh.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Webhook className={`h-4 w-4 ${wh.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-theme-primary text-sm">{wh.name}</p>
                    <p className="text-xs text-theme-muted">{getWebhookScope(wh).label}</p>
                    <p className="text-xs text-theme-muted truncate max-w-48">{wh.webhookUrl.slice(0, 40)}...</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${wh.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {wh.enabled ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Modificaciones', value: wh.notifyModifications },
                  { label: 'Último momento', value: wh.notifyLastMinute },
                  { label: 'Resumen viernes', value: wh.fridayReminderEnabled },
                  { label: 'Resumen lunes', value: wh.mondayAbsenceReminderEnabled },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    {item.value ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    )}
                    <span className={item.value ? 'text-theme-primary' : 'text-theme-muted'}>{item.label}</span>
                  </div>
                ))}
                {wh.fridayReminderEnabled && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-theme-muted" />
                    <span className="text-theme-secondary">Viernes {wh.fridayReminderTime}</span>
                  </div>
                )}
              </div>

              {canManageWebhooks ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => testMutation.mutate(wh.id)}
                    disabled={testMutation.isPending}
                    className="flex items-center gap-1.5 text-xs btn-ghost py-1.5 px-3"
                  >
                    <Play className="h-3 w-3" />Probar
                  </button>
                  <button type="button" onClick={() => setFormWebhook(wh)} className="flex items-center gap-1.5 text-xs btn-ghost py-1.5 px-3">
                    <Edit className="h-3 w-3" />Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(wh)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:bg-red-50 py-1.5 px-3 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />Eliminar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {formWebhook !== false && canManageWebhooks && (
        <WebhookForm key={formWebhook ? formWebhook.id : 'new'} webhook={formWebhook || undefined} onClose={() => setFormWebhook(false)} />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Eliminar Webhook"
        description={`¿Eliminar el webhook "${deleteConfirm?.name}"?`}
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteConfirm!.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

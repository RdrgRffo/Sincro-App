import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, RefreshCw, Send, Calendar, CheckCircle, XCircle, Clock, Umbrella, Globe, Building2, Users } from 'lucide-react';
import api from '@/config/api';
import type { Branch, Department, NotificationLog, WebhookConfig } from '@/types';
import { notificationTypeLabel } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ListPageSkeleton } from '@/components/common/Skeleton';
import { DataTable } from '@/components/common/DataTable';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { usePermission } from '@/hooks/usePermissions';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';

type ScopeFilter = 'all' | 'branch' | 'department' | 'specific';

function departmentBelongsToBranch(department: Department, branchId: string): boolean {
  if (!branchId) return true;
  return department.branches?.some((branchLink) => branchLink.branch.id === branchId) ?? false;
}

function filterWebhooksForScope(
  webhooks: WebhookConfig[],
  scope: ScopeFilter,
  branchId: string,
  departmentId: string,
): WebhookConfig[] {
  return webhooks.filter((wh) => {
    if (!wh.enabled) return false;
    if (scope === 'all') return true;
    if (scope === 'branch') return !branchId || wh.branchId === branchId;
    if (scope === 'department') return !departmentId || wh.departmentId === departmentId;
    if (scope === 'specific') {
      if (branchId && wh.branchId !== branchId) return false;
      if (departmentId && wh.departmentId !== departmentId) return false;
      return true;
    }
    return true;
  });
}

function webhookTargetLabel(wh: WebhookConfig): string {
  if (!wh.departmentId && !wh.branchId) return 'General';
  if (wh.departmentId && !wh.branchId) return `Dept: ${wh.department?.name ?? wh.departmentId}`;
  if (!wh.departmentId && wh.branchId) return `Suc: ${wh.branch?.name ?? wh.branchId}`;
  return `${wh.department?.name ?? wh.departmentId} en ${wh.branch?.name ?? wh.branchId}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-amber-400" />;
}

function ScopeSelector({
  scope,
  onScopeChange,
  branchId,
  onBranchChange,
  departmentId,
  onDepartmentChange,
  webhookId,
  onWebhookChange,
  branches,
  departments,
  webhooks,
  /** When set (GM role): hides the Sucursal tab/select; departments are pre-scoped to this branch */
  fixedBranchId,
}: {
  scope: ScopeFilter;
  onScopeChange: (s: ScopeFilter) => void;
  branchId: string;
  onBranchChange: (id: string) => void;
  departmentId: string;
  onDepartmentChange: (id: string) => void;
  webhookId: string;
  onWebhookChange: (id: string) => void;
  branches: Branch[];
  departments: Department[];
  webhooks: WebhookConfig[];
  fixedBranchId?: string;
}) {
  // When GM has a fixed branch, resolve the effective branch for filtering
  const effectiveBranchId = fixedBranchId ?? branchId;

  const filteredDepartments = useMemo(
    () => departments.filter((department) => departmentBelongsToBranch(department, effectiveBranchId)),
    [departments, effectiveBranchId],
  );

  const filteredWebhooks = useMemo(() => {
    return filterWebhooksForScope(webhooks, scope, effectiveBranchId, departmentId);
  }, [webhooks, scope, effectiveBranchId, departmentId]);

  const handleScopeChange = (nextScope: ScopeFilter) => {
    onScopeChange(nextScope);
    if (!fixedBranchId) onBranchChange('');
    onDepartmentChange('');
    onWebhookChange('');
  };

  const handleBranchChange = (nextBranchId: string) => {
    onBranchChange(nextBranchId);
    onDepartmentChange('');
    onWebhookChange('');
  };

  const handleDepartmentChange = (nextDepartmentId: string) => {
    onDepartmentChange(nextDepartmentId);
    onWebhookChange('');
  };

  // For GM (fixedBranchId): hide the 'branch' tab since their branch is implicit
  const scopeTabs = fixedBranchId
    ? [
        { value: 'all' as ScopeFilter, icon: Building2, label: 'Mi sede' },
        { value: 'department' as ScopeFilter, icon: Users, label: 'Departamento' },
        { value: 'specific' as ScopeFilter, icon: Bell, label: 'Específico' },
      ]
    : [
        { value: 'all' as ScopeFilter, icon: Globe, label: 'Todos' },
        { value: 'branch' as ScopeFilter, icon: Building2, label: 'Sucursal' },
        { value: 'department' as ScopeFilter, icon: Users, label: 'Departamento' },
        { value: 'specific' as ScopeFilter, icon: Bell, label: 'Específico' },
      ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {scopeTabs.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleScopeChange(opt.value)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
              scope === opt.value
                ? 'border-theme-primary bg-theme-primary/10 text-theme-primary font-medium'
                : 'border-theme-color text-theme-muted hover:border-theme-primary/40'
            )}
          >
            <opt.icon className="h-3 w-3" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Branch select: only for admin/manager (not GM with fixed branch) */}
      {!fixedBranchId && (scope === 'branch' || scope === 'department' || scope === 'specific') && (
        <select
          value={branchId}
          onChange={(e) => handleBranchChange(e.target.value)}
          className="input-field text-sm"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {(scope === 'department' || scope === 'specific') && (
        <select
          value={departmentId}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          className="input-field text-sm"
        >
          <option value="">
            {fixedBranchId ? 'Todos los departamentos de mi sede' : 'Todos los departamentos'}
          </option>
          {filteredDepartments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      {scope === 'specific' && (
        <select
          value={webhookId}
          onChange={(e) => onWebhookChange(e.target.value)}
          className="input-field text-sm"
        >
          <option value="">Seleccionar webhook...</option>
          {filteredWebhooks.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.name} ({webhookTargetLabel(wh)})
            </option>
          ))}
        </select>
      )}

      {filteredWebhooks.length > 0 && (
        <p className="text-xs text-theme-muted">
          Se enviará a {filteredWebhooks.length} webhook(s)
          {scope === 'branch' && effectiveBranchId && ` de la sucursal seleccionada`}
          {scope === 'department' && departmentId && ` del departamento seleccionado`}
          {scope === 'specific' && ` disponibles con los filtros actuales`}
          {fixedBranchId && scope === 'all' && ` de tu sede`}
        </p>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const canNotificationsSend = usePermission('notifications:send');
  const canWebhooksManage = usePermission('webhooks:manage');
  const canSendNotifications = canNotificationsSend || canWebhooksManage;

  // GM: sees their fixed branch only; admin sees all branches
  const currentUser = useAuthStore((s) => s.user);
  const isGM = currentUser?.role?.name === 'general_manager';
  const gmBranchId = isGM ? (currentUser?.branchId ?? '') : undefined;
  const [page, setPage] = useState(1);
  const [announcement, setAnnouncement] = useState('');

  // Monday absence summary filters
  const [absenceSummaryScope, setAbsenceSummaryScope] = useState<ScopeFilter>('all');
  const [absenceSummaryBranchId, setAbsenceSummaryBranchId] = useState('');
  const [absenceSummaryDeptId, setAbsenceSummaryDeptId] = useState('');
  const [absenceSummaryWebhookId, setAbsenceSummaryWebhookId] = useState('');

  // Friday summary filters
  const [fridayScope, setFridayScope] = useState<ScopeFilter>('all');
  const [fridayBranchId, setFridayBranchId] = useState('');
  const [fridayDeptId, setFridayDeptId] = useState('');
  const [fridayWebhookId, setFridayWebhookId] = useState('');

  // Announcement filters
  const [announceScope, setAnnounceScope] = useState<ScopeFilter>('all');
  const [announceBranchId, setAnnounceBranchId] = useState('');
  const [announceDeptId, setAnnounceDeptId] = useState('');
  const [announceWebhookId, setAnnounceWebhookId] = useState('');

  const { data, isLoading, refetch } = useNotificationLogs(page, 20);

  const resendMutation = useMutation({
    mutationFn: (logId: string) => api.post(`/notifications/resend/${logId}`),
    onSuccess: () => { toast.success('Notificación reenviada'); refetch(); },
    onError: () => toast.error('Error al reenviar'),
  });

  const { data: webhooks } = useQuery<WebhookConfig[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get<{ data: WebhookConfig[] }>('/webhooks').then((r) => r.data.data),
    enabled: true,
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches', 'notifications'],
    queryFn: () => api.get<{ data: Branch[] }>('/branches', { params: { includeInactive: false } }).then((r) => r.data.data),
    enabled: true,
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments', 'notifications'],
    queryFn: () => api.get<{ data: Department[] }>('/departments', { params: { includeInactive: false } }).then((r) => r.data.data),
    enabled: true,
  });

  // Helper: obtener webhookIds según el scope seleccionado
  function getWebhookIds(scope: ScopeFilter, branchId: string, deptId: string, whId: string): string[] | undefined {
    if (scope === 'specific' && whId) return [whId];
    if (scope === 'specific') return [];
    if (!webhooks) return undefined;
    return filterWebhooksForScope(webhooks, scope, branchId, deptId).map((wh) => wh.id);
  }

  const fridayMutation = useMutation({
    mutationFn: () => {
      const ids = getWebhookIds(fridayScope, fridayBranchId, fridayDeptId, fridayWebhookId);
      return api.post('/notifications/friday-summary', { webhookConfigIds: ids });
    },
    onSuccess: (res) => { toast.success(res.data.message || 'Resumen enviado'); refetch(); },
    onError: () => toast.error('Error al enviar resumen'),
  });

  const absenceSummaryMutation = useMutation({
    mutationFn: () => {
      const ids = getWebhookIds(absenceSummaryScope, absenceSummaryBranchId, absenceSummaryDeptId, absenceSummaryWebhookId);
      return api.post('/notifications/absence-summary', { webhookConfigIds: ids });
    },
    onSuccess: (res) => { toast.success(res.data.message || 'Resumen de ausencias enviado'); refetch(); },
    onError: () => toast.error('Error al enviar resumen de ausencias'),
  });

  const announceMutation = useMutation({
    mutationFn: () => {
      const ids = getWebhookIds(announceScope, announceBranchId, announceDeptId, announceWebhookId);
      return api.post('/notifications/announce', { message: announcement, webhookConfigIds: ids });
    },
    onSuccess: () => { toast.success('Anuncio enviado'); setAnnouncement(''); refetch(); },
    onError: () => toast.error('Error al enviar anuncio'),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Centro de Notificaciones</h1>
          <p className="text-sm text-theme-muted mt-0.5">
            Historial de envíos a Teams y envíos manuales (resúmenes, anuncios, reenvíos)
          </p>
        </div>
      </div>

      {/* Envíos manuales y reenvíos: API acepta `notifications:send` (GM, acotado a su sede) o `webhooks:manage` (admin, CRUD + envíos). */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Ausencias de la semana (resumen lunes) */}
        <div className="card p-7 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn('p-2 rounded-lg bg-green-50')}>
              <Umbrella className={cn('h-4 w-4 text-green-600')} />
            </div>
            <div>
              <p className="font-semibold text-theme-primary text-sm">Ausencias de la semana</p>
              <p className="text-xs text-theme-muted">Automático cada lunes a las 8:30h</p>
            </div>
          </div>
          <div className="flex-1">
            <ScopeSelector
              scope={absenceSummaryScope}
              onScopeChange={setAbsenceSummaryScope}
              branchId={absenceSummaryBranchId}
              onBranchChange={setAbsenceSummaryBranchId}
              departmentId={absenceSummaryDeptId}
              onDepartmentChange={setAbsenceSummaryDeptId}
              webhookId={absenceSummaryWebhookId}
              onWebhookChange={setAbsenceSummaryWebhookId}
              branches={branches ?? []}
              departments={departments ?? []}
              webhooks={webhooks ?? []}
              fixedBranchId={gmBranchId}
            />
          </div>
          <button
            onClick={() => absenceSummaryMutation.mutate()}
            disabled={
              !canSendNotifications ||
              absenceSummaryMutation.isPending ||
              (absenceSummaryScope === 'specific' && !absenceSummaryWebhookId)
            }
            className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60 bg-green-600 hover:bg-green-700 border-green-600 mt-auto pt-3"
          >
            {absenceSummaryMutation.isPending ? <LoadingSpinner size="sm" className="border-white border-t-white/30" /> : <Umbrella className="h-3.5 w-3.5" />}
            Enviar resumen ahora
          </button>
        </div>

        {/* Friday summary */}
        <div className="card p-7 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn('p-2 rounded-lg bg-gray-50')}>
              <Calendar className={cn('h-4 w-4 text-gray-600')} />
            </div>
            <div>
              <p className="font-semibold text-theme-primary text-sm">Resumen Semanal</p>
              <p className="text-xs text-theme-muted">Enviar planificación de la semana siguiente</p>
            </div>
          </div>
          <div className="flex-1">
            <ScopeSelector
              scope={fridayScope}
              onScopeChange={setFridayScope}
              branchId={fridayBranchId}
              onBranchChange={setFridayBranchId}
              departmentId={fridayDeptId}
              onDepartmentChange={setFridayDeptId}
              webhookId={fridayWebhookId}
              onWebhookChange={setFridayWebhookId}
              branches={branches ?? []}
              departments={departments ?? []}
              webhooks={webhooks ?? []}
              fixedBranchId={gmBranchId}
            />
          </div>
          <button
            onClick={() => fridayMutation.mutate()}
            disabled={
              !canSendNotifications ||
              fridayMutation.isPending ||
              (fridayScope === 'specific' && !fridayWebhookId)
            }
            className="w-full btn-gold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-auto pt-3"
          >
            {fridayMutation.isPending ? <LoadingSpinner size="sm" /> : <Calendar className="h-3.5 w-3.5" />}
            Enviar resumen ahora
          </button>
        </div>

        {/* Manual announcement */}
        <div className="card p-7 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-theme-surface-muted rounded-lg">
              <Send className={cn('h-4 w-4 text-theme-secondary')} />
            </div>
            <div>
              <p className="font-semibold text-theme-primary text-sm">Anuncio Manual</p>
              <p className="text-xs text-theme-muted">Enviar mensaje personalizado</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <ScopeSelector
              scope={announceScope}
              onScopeChange={setAnnounceScope}
              branchId={announceBranchId}
              onBranchChange={setAnnounceBranchId}
              departmentId={announceDeptId}
              onDepartmentChange={setAnnounceDeptId}
              webhookId={announceWebhookId}
              onWebhookChange={setAnnounceWebhookId}
              branches={branches ?? []}
              departments={departments ?? []}
              webhooks={webhooks ?? []}
              fixedBranchId={gmBranchId}
            />
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="input-field resize-none text-sm mt-1"
              rows={2}
              placeholder="Escribe tu anuncio..."
            />
          </div>
          <button
            onClick={() => announceMutation.mutate()}
            disabled={
              !canSendNotifications ||
              !announcement.trim() ||
              announceMutation.isPending ||
              (announceScope === 'specific' && !announceWebhookId)
            }
            className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-auto pt-3"
          >
            {announceMutation.isPending ? <LoadingSpinner size="sm" className="border-white border-t-white/30" /> : <Send className="h-3.5 w-3.5" />}
            Enviar anuncio
          </button>
        </div>
      </div>

      {/* Log table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-color">
          <h2 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-600" />
            Historial de Notificaciones
          </h2>
          <button onClick={() => refetch()} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {isLoading ? (
          <ListPageSkeleton />
        ) : !data?.data?.length ? (
          <EmptyState icon={Bell} title="Sin notificaciones" description="Las notificaciones enviadas aparecerán aquí" />
        ) : (
          <>
            <DataTable<NotificationLog>
              data={data.data}
              rowKey={(log) => log.id}
              columns={[
                {
                  key: 'status',
                  label: 'Estado',
                  render: (log) => <StatusIcon status={log.status} />,
                },
                {
                  key: 'type',
                  label: 'Tipo',
                  render: (log) => (
                    <span className="text-xs bg-theme-surface-muted text-theme-secondary px-2 py-0.5 rounded-full font-medium">
                      {notificationTypeLabel(log.type)}
                    </span>
                  ),
                },
                {
                  key: 'message',
                  label: 'Mensaje',
                  hide: 'md',
                  className: 'max-w-xs truncate',
                  render: (log) => <span className="text-xs text-theme-muted">{log.message}</span>,
                },
                {
                  key: 'webhook',
                  label: 'Webhook',
                  hide: 'lg',
                  render: (log) => <span className="text-xs text-theme-muted">{log.webhookConfig?.name || '—'}</span>,
                },
                {
                  key: 'sentAt',
                  label: 'Fecha',
                  render: (log) => <span className="text-xs text-theme-muted">{formatDateTime(log.sentAt)}</span>,
                },
              ]}
              renderActions={(log) =>
                canSendNotifications && log.status === 'failed' ? (
                  <button
                    type="button"
                    onClick={() => resendMutation.mutate(log.id)}
                    disabled={resendMutation.isPending}
                    className="text-xs text-theme-muted hover:text-theme-primary flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />Reenviar
                  </button>
                ) : null
              }
            />
            {data?.pagination?.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-theme-color">
                <p className="text-xs text-theme-muted">Página {page} de {data.pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-xs font-medium rounded border border-theme-color text-theme-primary hover:bg-theme-surface-muted disabled:opacity-40">Anterior</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pagination.totalPages} className="px-3 py-1 text-xs font-medium rounded border border-theme-color text-theme-primary hover:bg-theme-surface-muted disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

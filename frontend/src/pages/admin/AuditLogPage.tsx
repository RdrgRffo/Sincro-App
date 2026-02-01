import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { ShieldCheck, RefreshCw, Lock, Download, ClipboardList, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/config/api';
import type { AuditLog, Branch, Department, PaginatedResponse } from '@/types';
import { FilterTable, type FilterFieldConfig } from '@/components/common/FilterTable';
import { DataTable } from '@/components/common/DataTable';
import type { AuditSortBy, SortOrder } from '@/types';
import type { Column } from '@/components/common/DataTable';
import { AuditTabs, type TabType } from '@/components/audit/AuditTabs';
import { AuditDetailPanel } from '@/components/audit/AuditDetailPanel';
import { AuditExportModal } from '@/components/audit/AuditExportModal';
import { ListPageSkeleton } from '@/components/common/Skeleton';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDateTime } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type AuditFilterKey = 'action' | 'entityType' | 'userDepartment' | 'userId' | 'from' | 'to' | 'branchId';
type AuditDetails = { before?: unknown; after?: unknown };
type AuditListResponse = PaginatedResponse<AuditLog>;

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-gray-100 text-gray-700',
  LOGOUT: 'bg-gray-100 text-gray-500',
  CREATE_USER: 'bg-gray-100 text-gray-800',
  UPDATE_USER: 'bg-gray-100 text-gray-700',
  DELETE_USER: 'bg-gray-200 text-gray-800',
  USER_STATUS_CHANGE: 'bg-gray-100 text-gray-700',
  USER_ROLE_CHANGE: 'bg-gray-200 text-gray-800',
  RESET_PASSWORD: 'bg-gray-100 text-gray-700',
  CREATE_SCHEDULE: 'bg-gray-100 text-gray-800',
  UPDATE_SCHEDULE: 'bg-gray-100 text-gray-700',
  DELETE_SCHEDULE: 'bg-gray-200 text-gray-800',
  CREATE_WEBHOOK: 'bg-gray-100 text-gray-800',
  CHANGE_PASSWORD: 'bg-gray-100 text-gray-700',
  FAILED_LOGIN_ATTEMPT: 'bg-gray-200 text-gray-800',
  CREATE_ABSENCE_REQUEST: 'bg-gray-100 text-gray-800',
  APPROVE_ABSENCE: 'bg-gray-100 text-gray-700',
  REJECT_ABSENCE: 'bg-gray-200 text-gray-800',
  CANCEL_ABSENCE: 'bg-gray-100 text-gray-600',
};

const AUDIT_FILTER_FIELDS_BASE: Array<FilterFieldConfig<AuditFilterKey>> = [
  { key: 'action', type: 'text', label: 'Acción', id: 'audit-search', placeholder: 'Filtrar por acción...', className: 'min-w-56' },
  { key: 'entityType', type: 'select', label: 'Tipo entidad', id: 'audit-entity-type', className: 'w-44', options: [
    { value: '', label: 'Todos los tipos' }, { value: 'User', label: 'Usuario' },
    { value: 'Schedule', label: 'Turno' }, { value: 'WebhookConfig', label: 'Webhook' },
    { value: 'Absence', label: 'Ausencia' },
  ]},
  { key: 'branchId', type: 'select', label: 'Sucursal', className: 'w-44', options: [] },
  { key: 'userDepartment', type: 'select', label: 'Departamento', options: [] },
  { key: 'userId', type: 'select', label: 'Usuario', className: 'w-48', options: [] },
  { key: 'from', type: 'date', label: 'Fecha desde', className: 'w-36' },
  { key: 'to', type: 'date', label: 'Fecha hasta', className: 'w-36' },
];

function toSnapshotValue(value: unknown): string | Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return String(value);
}

function parseAuditDetails(value: unknown): AuditDetails {
  if (!value) return {};
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value) as unknown; if (parsed && typeof parsed === 'object') return parsed as AuditDetails; return {}; }
    catch { return {}; }
  }
  if (typeof value === 'object') return value as AuditDetails;
  return {};
}

function getLogDisplayName(log: AuditLog): string {
  const details = parseAuditDetails(log.detailsJson) as Record<string, unknown>;
  const meta = details.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.resumen === 'string' && meta.resumen.trim()) {
    return meta.resumen.trim();
  }
  const after = (details.after ?? {}) as Record<string, unknown>;
  const before = (details.before ?? {}) as Record<string, unknown>;
  if (log.entityType === 'Absence') {
    const t = after.type ?? before.type;
    if (typeof t === 'string' && t.trim()) {
      return `Ausencia · ${t}`;
    }
  }
  const candidate = after.title ?? after.name ?? details.title ?? details.name ?? before.title ?? before.name;
  return typeof candidate === 'string' && candidate.trim() ? candidate : (log.entityId || '-');
}

export function AuditLogPage() {
  const location = useLocation();
  const navState = location.state as { selectedLogId?: string; activeTab?: TabType } | null;

  const [activeTab, setActiveTab] = useState<TabType>(navState?.activeTab || 'reversible');
  const [filters, setFilters] = useState<Record<AuditFilterKey, string>>({
    action: '', userId: '', entityType: '', userDepartment: '', from: '', to: '', branchId: '',
  });

  // Implementación de debounce para evitar re-peticiones constantes al escribir y parpadeos en la UI
  const [debouncedAction, setDebouncedAction] = useState(filters.action);
  const [sortBy, setSortBy] = useState<AuditSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pageRev, setPageRev] = useState(1);
  const [pageIrr, setPageIrr] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAction(filters.action);
      setPageRev(1);
      setPageIrr(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.action]);

  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string }>>([]);
  const { data: departmentsData } = useQuery<{ data: Department[] }>({
    queryKey: ['departments', 'audit', filters.branchId],
    queryFn: () => api.get('/departments', { params: { branchId: filters.branchId, includeInactive: true } }).then((r) => r.data),
    enabled: Boolean(filters.branchId),
  });
  const [selectedLogId, setSelectedLogId] = useState<string | null>(navState?.selectedLogId || null);
  const [showExportModal, setShowExportModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    api.get('/branches')
      .then((r) => setAvailableBranches(r.data?.data ?? []))
      .catch(() => setAvailableBranches([]));
  }, []);

  useEffect(() => {
    if (!filters.branchId && !filters.userDepartment) return;
    const params: Record<string, string | number> = { limit: 100 };
    if (filters.branchId) params.branchId = filters.branchId;
    if (filters.userDepartment) params.department = filters.userDepartment;
    let cancelled = false;
    api.get('/users', { params })
      .then((r) => { if (!cancelled) setAvailableUsers((r.data?.data ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))); })
      .catch(() => { if (!cancelled) setAvailableUsers([]); });
    return () => { cancelled = true; };
  }, [filters.branchId, filters.userDepartment]);

  const commonParams = {
    limit: 20,
    action: debouncedAction || undefined,
    entityType: filters.entityType || undefined,
    userId: filters.userId || undefined,
    userDepartment: filters.userDepartment || undefined,
    branchId: filters.branchId || undefined,
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
    sortBy, sortOrder,
  };

  const handleFilterChange = (key: AuditFilterKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    // For the 'action' field the debounce effect handles page reset to avoid
    // resetting on every keystroke before the query actually fires.
    if (key !== 'action') {
      setPageRev(1); setPageIrr(1);
    }
  };

  const handleSortChange = (field: AuditSortBy) => {
    setPageRev(1); setPageIrr(1);
    if (sortBy === field) { setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc')); return; }
    setSortBy(field);
    setSortOrder(field === 'createdAt' ? 'desc' : 'asc');
  };

  const { data: dataRev, isLoading: loadingRev } = useQuery({
    queryKey: ['audit', 'reversible', pageRev, debouncedAction, filters.entityType, filters.userId, filters.userDepartment, filters.branchId, filters.from, filters.to, sortBy, sortOrder],
    queryFn: () => api.get('/audit', { params: { ...commonParams, page: pageRev, reversible: 'true' } }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: dataIrr, isLoading: loadingIrr } = useQuery({
    queryKey: ['audit', 'irreversible', pageIrr, debouncedAction, filters.entityType, filters.userId, filters.userDepartment, filters.branchId, filters.from, filters.to, sortBy, sortOrder],
    queryFn: () => api.get('/audit', { params: { ...commonParams, page: pageIrr, reversible: 'false' } }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const { data: selectedLog, isLoading: loadingDetail } = useQuery({
    queryKey: ['audit-detail', selectedLogId],
    queryFn: () => api.get<{ data: AuditLog }>(`/audit/${selectedLogId}`).then((r) => r.data.data),
    enabled: Boolean(selectedLogId),
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/audit/${id}/rollback`),
    onSuccess: (_, logId) => {
      toast.success('Cambio revertido correctamente');
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['audit-detail', logId] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Error al revertir el cambio')),
  });

  const selectedLogDetails = parseAuditDetails(selectedLog?.detailsJson);
  const beforeSnapshot = toSnapshotValue(
    selectedLogDetails.before !== undefined ? selectedLogDetails.before : (selectedLog?.action.includes('DELETE') ? selectedLog.detailsJson : null),
  );
  const afterSnapshot = toSnapshotValue(
    selectedLogDetails.after !== undefined ? selectedLogDetails.after
      : (!selectedLog?.action.includes('DELETE') && !selectedLog?.action.includes('UPDATE') && selectedLogDetails.before === undefined ? selectedLog?.detailsJson : null),
  );

  const canRollback = selectedLog && !['LOGIN', 'LOGOUT', 'CHANGE_PASSWORD', 'RESET_PASSWORD', 'FAILED_LOGIN_ATTEMPT', 'ROLLBACK_PERFORMED'].includes(selectedLog.action) && !selectedLog.rolledBackAt && (selectedLogDetails.before !== undefined || selectedLog.action.includes('CREATE'));

  const handleSelectLog = (id: string) => setSelectedLogId((prev) => (prev === id ? null : id));
  const handleTabChange = (tab: TabType) => { setActiveTab(tab); setSelectedLogId(null); };

  const tabs: { key: TabType; label: string; icon: LucideIcon; count?: number; description: string }[] = [
    { key: 'reversible', label: 'Acciones de Datos', icon: RefreshCw, count: dataRev?.pagination?.total, description: 'Modificaciones sobre usuarios, turnos y configuraciones que pueden revertirse.' },
    { key: 'irreversible', label: 'Eventos de Seguridad', icon: Lock, count: dataIrr?.pagination?.total, description: 'Inicios de sesión, cierres de sesión y cambios de contraseña. No revertibles.' },
  ];

  // Solo mostramos el skeleton si realmente no hay datos en absoluto (primera carga)
  const isInitialLoading = (loadingRev || loadingIrr) && !dataRev && !dataIrr;

  const auditColumns: Column<AuditLog>[] = [
    {
      key: 'action',
      label: 'Acción',
      sortable: true,
      render: (log) => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
          {log.action.replace(/_/g, ' ')}
          {log.rolledBackAt && <span className="ml-1 opacity-70">(ROLLBACK)</span>}
        </span>
      ),
    },
    {
      key: 'userName',
      label: 'Usuario',
      sortable: true,
      hide: 'md',
      render: (log) => <span className="text-sm text-theme-secondary">{log.user?.name || 'Sistema'}</span>,
    },
    {
      key: 'userDepartment',
      label: 'Departamento',
      hide: 'lg',
      render: (log) => (
        log.user?.department?.name
          ? <span className="text-xs text-theme-muted">{log.user.department.name}</span>
          : <span className="text-xs text-theme-muted/70">-</span>
      ),
    },
    {
      key: 'resource',
      label: 'Recurso',
      hide: 'lg',
      render: (log) => <span className="text-xs text-theme-muted">{getLogDisplayName(log)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Fecha',
      sortable: true,
      render: (log) => <span className="text-xs text-theme-muted">{formatDateTime(log.createdAt)}</span>,
    },
  ];

  const renderAuditLogList = (
    tableData: AuditListResponse | undefined,
    isLoading: boolean,
    page: number,
    onPageChange: (page: number) => void,
    emptyDescription: string,
  ) => {
    const pagination = tableData?.pagination;
    const rows = (tableData?.data ?? []).filter((log) => log.action !== 'ROLLBACK_PERFORMED');

    return (
      <>
        <DataTable<AuditLog>
          data={rows}
          columns={auditColumns}
          rowKey={(log) => log.id}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field) => handleSortChange(field as AuditSortBy)}
          onRowClick={(log) => handleSelectLog(log.id)}
          getRowClassName={(log) => (selectedLogId === log.id ? 'bg-theme-surface-muted' : '')}
          isLoading={isLoading}
          emptyIcon={ClipboardList}
          emptyTitle="Sin registros"
          emptyDescription={emptyDescription}
          actionsLabel=""
          renderActions={() => <ChevronRight className="h-3.5 w-3.5 text-theme-muted" />}
        />

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-theme-color">
            <p className="text-xs text-theme-muted">Página {page} de {pagination.totalPages} · {pagination.total} registros</p>
            <div className="flex gap-2">
              <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
                className="px-3 py-1 text-xs font-medium rounded border border-theme-color text-theme-primary hover:bg-theme-surface-muted disabled:opacity-40">Anterior</button>
              <button onClick={() => onPageChange(page + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 text-xs font-medium rounded border border-theme-color text-theme-primary hover:bg-theme-surface-muted disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </>
    );
  };

  // Memoización de la configuración de campos para estabilizar la identidad de los inputs en FilterTable
  const filterFields = useMemo(() => {
    return AUDIT_FILTER_FIELDS_BASE.map((field) => {
      if (field.key === 'branchId') {
        return { ...field, options: [{ value: '', label: 'Todas las sucursales' }, ...availableBranches.map((b) => ({ value: b.id, label: b.name }))] };
      }
      if (field.key === 'userId') {
        return { ...field, options: [
          { value: '', label: filters.branchId || filters.userDepartment ? 'Todos los usuarios' : 'Selecciona sucursal o departamento' },
          ...availableUsers.map((u) => ({ value: u.id, label: u.name })),
        ] };
      }
      if (field.key === 'userDepartment') {
        return { ...field, options: [
          { value: '', label: filters.branchId ? 'Todos los departamentos' : 'Selecciona una sucursal' },
          ...(departmentsData?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
        ] };
      }
      return field;
    });
  }, [availableBranches, availableUsers, departmentsData, filters.branchId, filters.userDepartment]);

  if (isInitialLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Registro de Auditoría</h1>
          <p className="text-sm text-theme-muted mt-0.5">Historial completo de acciones del sistema</p>
        </div>
        <button onClick={() => setShowExportModal(true)} className="btn-ghost text-sm flex items-center gap-2">
          <Download className="h-4 w-4" />Exportar CSV
        </button>
      </div>

      <div className="card px-4 py-3">
        <FilterTable
          fields={filterFields}
          values={filters}
          onChange={handleFilterChange}
          className="!p-0 !gap-3 !border-0 !shadow-none"
        />
      </div>

      <AuditTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      <div className="flex items-start gap-2 px-1">
        <ShieldCheck className="h-4 w-4 text-theme-muted mt-0.5 shrink-0" />
        <p className="text-xs text-theme-muted">{tabs.find((t) => t.key === activeTab)?.description}</p>
      </div>

      <div className="flex gap-4">
        <div className={`card overflow-hidden ${selectedLogId ? 'flex-1' : 'w-full'}`}>
          {activeTab === 'reversible' && (
            renderAuditLogList(dataRev, loadingRev, pageRev, setPageRev, 'No se encontraron acciones de datos con los filtros actuales.')
          )}
          {activeTab === 'irreversible' && (
            renderAuditLogList(dataIrr, loadingIrr, pageIrr, setPageIrr, 'No se encontraron eventos de seguridad con los filtros actuales.')
          )}
        </div>

        {selectedLogId && (
          <AuditDetailPanel
            selectedLog={selectedLog ?? null}
            isLoading={loadingDetail}
            onClose={() => setSelectedLogId(null)}
            onRollback={() => { if (window.confirm('¿Estás seguro de que deseas revertir este cambio? Esta acción no se puede deshacer.')) rollbackMutation.mutate(selectedLog!.id); }}
            canRollback={canRollback ?? false}
            isPending={rollbackMutation.isPending}
            activeTab={activeTab}
            beforeSnapshot={beforeSnapshot}
            afterSnapshot={afterSnapshot}
          />
        )}
      </div>

      {showExportModal && <AuditExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}

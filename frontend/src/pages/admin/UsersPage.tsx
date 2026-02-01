import { useEffect, useRef, useState, useMemo, useCallback, type ChangeEvent, type MouseEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, Download, Shield, MoreVertical } from 'lucide-react';
import { formatRelative } from 'date-fns';
import { es } from 'date-fns/locale';


import api from '@/config/api';
import { type Branch, type User, ROLE_LABELS } from '@/types';
import { getApiErrorMessage } from '@/lib/apiError';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { TableSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { DataTable } from '@/components/common/DataTable';
import { FilterTable, type FilterFieldConfig } from '@/components/common/FilterTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { UserProfileModal } from '@/components/common/UserProfileModal';
import { ImportCsvProgressModal } from '@/components/common/ImportCsvProgressModal';
import { UsersPagination } from '@/components/users/UsersPagination';
import { UserActionMenu } from '@/components/users/UserActionMenu';
import type { UsersSortBy } from '@/types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useUsersData } from '@/hooks/useUsersData';
import { useUsersPage } from '@/hooks/useUsersPage';
import {
  USERS_CSV_HEADERS,
  buildCsv,
  decodeCsvFile,
  detectCsvDelimiter,
  downloadCsv,
  parseCsvLine,
  type UsersCsvRow,
} from '@/utils/usersCsv';
import { UserFormModal } from './UserFormModal';
import { ResetPasswordModal } from './ResetPasswordModal';
const ALLOWED_ROLES = new Set(['admin', 'general_manager', 'department_manager', 'employee']);
const ALLOWED_STATUS = new Set(['active', 'disabled', 'locked']);

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  disabled: 'Deshabilitado',
  locked: 'Bloqueado',
};

type UsersFilterKey = 'search' | 'role' | 'status' | 'departmentId' | 'branchId' | 'employeeId' | 'lastLoginFrom' | 'lastLoginTo' | 'createdFrom' | 'createdTo';

export function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const roleName = currentUser?.role?.name ?? '';
  const isAdmin = roleName === 'admin';
  const isGeneralManager = roleName === 'general_manager';
  const isDepartmentManager = roleName === 'department_manager';
  const usersTemplateCsvUrl = `${import.meta.env.BASE_URL}templates/Plantilla%20CSV.xlsx`;
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    filters,
    sortBy,
    sortOrder,
    page,
    setPage,
    limit,
    setLimit,
    handleFilterChange,
    handleSortChange,
    query,
  } = useUsersPage(currentUser);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [formUser, setFormUser] = useState<User | null | false>(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; user: User } | null>(null);
  const [csvImportState, setCsvImportState] = useState<{
    open: boolean;
    fileName: string;
    result?: { created: number; updated: number; unchanged: number; failed: number } | null;
    error?: string | null;
  }>({ open: false, fileName: '' });
  const pendingCsvFile = useRef<File | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const closeMenu = () => { setMenuOpenId(null); setMenuPosition(null); };
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuOpenId]);

  const { availableBranches, departments } = useUsersData(currentUser);

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'Todas las sucursales' },
      ...(availableBranches ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
    ],
    [availableBranches],
  );

  const departmentOptions = useMemo(
    () => [
      { value: '', label: 'Todos los departamentos' },
      ...(departments ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
    ],
    [departments],
  );

  const USERS_FILTER_FIELDS_DYNAMIC: Array<FilterFieldConfig<UsersFilterKey>> = useMemo(
    () => [
      {
        key: 'search',
        type: 'text',
        label: 'Buscar',
        placeholder: 'Nombre o email...',
        className: 'min-w-56',
      },
      {
        key: 'role',
        type: 'select',
        label: 'Rol',
        options: [
          { value: '', label: 'Todos los roles' },
          { value: 'admin', label: 'Administrador' },
          { value: 'general_manager', label: 'Gerente General' },
          { value: 'department_manager', label: 'Responsable' },
          { value: 'employee', label: 'Empleado' },
        ],
      },
      {
        key: 'status',
        type: 'select',
        label: 'Estado',
        options: [
          { value: '', label: 'Todos los estados' },
          { value: 'active', label: 'Activo' },
          { value: 'disabled', label: 'Deshabilitado' },
          { value: 'locked', label: 'Bloqueado' },
        ],
      },
      ...(isGeneralManager || isDepartmentManager ? [] : [{
        key: 'branchId' as const,
        type: 'select' as const,
        label: 'Sucursal',
        options: branchOptions,
      }]),
      ...(isDepartmentManager ? [] : [{
        key: 'departmentId' as const,
        type: 'select' as const,
        label: 'Departamento',
        options: departmentOptions,
      }]),
      {
        key: 'lastLoginFrom',
        type: 'date',
        label: 'Último login desde',
        className: 'w-36',
      },
      {
        key: 'lastLoginTo',
        type: 'date',
        label: 'Último login hasta',
        className: 'w-36',
      },
      {
        key: 'createdFrom',
        type: 'date',
        label: 'Creado desde',
        className: 'w-36',
      },
      {
        key: 'createdTo',
        type: 'date',
        label: 'Creado hasta',
        className: 'w-36',
      },
    ],
    [branchOptions, departmentOptions, isDepartmentManager, isGeneralManager],
  );

  const { data, isLoading } = query;

  

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Estado actualizado'); setConfirmAction(null); },
    onError: () => toast.error('Error al actualizar estado'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuario eliminado'); setConfirmAction(null); },
    onError: () => toast.error('Error al eliminar usuario'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/reactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuario reactivado'); setMenuOpenId(null); setMenuPosition(null); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo reactivar el usuario')),
  });

  const forcePasswordChangeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/force-password-change`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Cambio de contraseña forzado'); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo forzar el cambio de contraseña')),
  });

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      const allUsers: User[] = [];
      let currentPage = 1;
      while (true) {
        const response = await api.get<{ data: User[]; pagination: { totalPages: number } }>('/users', {
          params: { page: currentPage, limit: 100 },
        });
        allUsers.push(...response.data.data);
        if (currentPage >= response.data.pagination.totalPages) break;
        currentPage += 1;
      }
      const rows = allUsers.map((user) => ({
        // Export `employeeId` when present; fall back to `id` if missing
        employeeId: user.employeeId ?? user.id ?? '',
        name: user.name ?? '',
        email: user.email ?? '',
        role: user.role?.name ?? '',
        status: user.status ?? '',
        department: user.department?.code ?? '',
        branchId: user.branch?.code ?? '', companyPhone: user.companyPhone ?? '', auxiliaryPhone: user.auxiliaryPhone ?? '',
      }));
      const csv = buildCsv(rows, [...USERS_CSV_HEADERS]);
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(`users-export-${date}.csv`, csv);
      return allUsers.length;
    },
    onSuccess: (total) => toast.success(`CSV exportado (${total} usuarios)`),
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo exportar el CSV')),
  });

  const importCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
        const response = await api.post('/users/import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      return response.data;
    },
    onSuccess: (response) => {
      const summary = response.data;
      if (summary.created > 0 || summary.updated > 0) qc.invalidateQueries({ queryKey: ['users'] });
      if (summary.failed > 0) {
        const rejectedCsv = buildCsv(summary.rejectedRows, [...USERS_CSV_HEADERS, 'reason']);
        downloadCsv('users-import-rejected.csv', rejectedCsv);
      }
      setCsvImportState({
        open: true,
        fileName: pendingCsvFile.current?.name ?? '',
        result: { created: summary.created, updated: summary.updated, unchanged: summary.unchanged, failed: summary.failed },
        error: null,
      });
      toast.success(`Importación completada: ${summary.created} creados, ${summary.updated} actualizados, ${summary.unchanged} sin cambios, ${summary.failed} rechazados`);
      pendingCsvFile.current = null;
    },
    onError: (error: unknown) => {
      const errorMsg = getApiErrorMessage(error, 'No se pudo importar el CSV');
      setCsvImportState({
        open: true,
        fileName: pendingCsvFile.current?.name ?? '',
        result: null,
        error: errorMsg,
      });
      pendingCsvFile.current = null;
    },
  });

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleMenuToggle = (userId: string, event: MouseEvent<HTMLButtonElement>) => {
    if (menuOpenId === userId) { setMenuOpenId(null); setMenuPosition(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = isAdmin ? 260 : 48;
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < (menuHeight + viewportPadding);
    const top = openUp
      ? Math.max(viewportPadding, rect.top - menuHeight - 4)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + 4);
    const left = Math.min(window.innerWidth - menuWidth - viewportPadding, Math.max(viewportPadding, rect.right - menuWidth));
    setMenuOpenId(userId);
    setMenuPosition({ top, left });
  };

  const validateCsvRow = (row: UsersCsvRow, index: number, branchesCatalog: Branch[]): string | null => {
    if (!row.name?.trim()) return `Fila ${index + 2}: El nombre es obligatorio`;
    if (!row.email?.trim() || !row.email.includes('@')) return `Fila ${index + 2}: Email inválido`;
    const branchValue = row.branchId?.trim();
    if (!branchValue) return `Fila ${index + 2}: La sucursal es obligatoria`;
    const normalizedBranch = branchValue.toUpperCase();
    const normalizedBranchName = branchValue.toLowerCase();
    const branchExists = branchesCatalog.some(
      (branch) => branch.code.toUpperCase() === normalizedBranch || branch.name.toLowerCase().includes(normalizedBranchName),
    );
    if (!branchExists) return `Fila ${index + 2}: Sucursal inválida "${row.branchId}". Usa TFN, GC o nombre de sede`;
    if (row.role && !ALLOWED_ROLES.has(row.role.trim().toLowerCase())) return `Fila ${index + 2}: Rol inválido "${row.role}"`;
    if (row.status && !ALLOWED_STATUS.has(row.status.trim().toLowerCase())) return `Fila ${index + 2}: Estado inválido "${row.status}"`;
    return null;
  };

  const handleCsvSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) { toast.error('Selecciona un archivo CSV válido'); return; }
    const text = await decodeCsvFile(file);
    
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length <= 1) { toast.error('El archivo CSV está vacío o solo contiene cabeceras'); return; }
    const delimiter = detectCsvDelimiter(lines[0]);
    const normalizedHeaders = parseCsvLine(lines[0], delimiter).map((column) => column.trim().toLowerCase());
    const columnIndices: Record<string, number> = {};
    USERS_CSV_HEADERS.forEach((header) => { columnIndices[header] = normalizedHeaders.findIndex((col) => col === header.toLowerCase() || col.includes(header.toLowerCase())); });
    const missingHeaders = USERS_CSV_HEADERS.filter((header) => columnIndices[header] < 0);
    if (missingHeaders.length > 0) { toast.error(`Faltan columnas obligatorias en el CSV: ${missingHeaders.join(', ')}`); return; }
    const branchesResponse = await api.get<{ data: Branch[] }>('/branches', { params: { includeInactive: true } });
    const branchesCatalog = branchesResponse.data.data ?? [];
    if (branchesCatalog.length === 0) { toast.error('No se pudo validar el catálogo de sucursales para importar el CSV'); return; }
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const cols = parseCsvLine(lines[i], delimiter);
      const rowData = {} as UsersCsvRow;
      USERS_CSV_HEADERS.forEach((header) => { rowData[header] = cols[columnIndices[header]]?.trim() || ''; });
      const error = validateCsvRow(rowData, i - 1, branchesCatalog);
      if (error) { toast.error(error); return; }
    }
    // Abrir modal de progreso y ejecutar importación
    pendingCsvFile.current = file;
    setCsvImportState({ open: true, fileName: file.name, result: null, error: null });
    await importCsvMutation.mutateAsync(file);
  };

  const handleRetryImport = useCallback(() => {
    const file = pendingCsvFile.current;
    if (!file) return;
    setCsvImportState({ open: true, fileName: file.name, result: null, error: null });
    importCsvMutation.mutateAsync(file);
  }, [importCsvMutation]);

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = usersTemplateCsvUrl;
    link.download = 'Plantilla CSV.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const roleBadge = (role: string) => {
    const cls: Record<string, string> = {
      admin: 'badge-role-admin',
      general_manager: 'badge-role-manager',
      department_manager: 'badge-role-manager',
      employee: 'badge-role-employee',
    };
    return <span className={cls[role] || 'badge-role-employee'}>{ROLE_LABELS[role] || role}</span>;
  };

  const statusBadge = (status: string) => {
    const cls = { active: 'badge-status-active', disabled: 'badge-status-disabled', locked: 'badge-status-locked' };
    return <span className={cls[status as keyof typeof cls] || 'badge-status-disabled'}>{STATUS_LABELS[status]}</span>;
  };

  const openMenuUser = data?.data?.find((user) => user.id === menuOpenId) ?? null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Gestión de Usuarios</h1>
          <p className="text-sm text-theme-muted mt-0.5">Administra cuentas. Sedes válidas: TFN (Tenerife), GC (Las Palmas)</p>
        </div>
        {(isAdmin || isGeneralManager) && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isAdmin && (
              <>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvSelected} data-testid="csv-upload-input" />
                <button type="button" onClick={handleImportClick} disabled={importCsvMutation.isPending} className="btn-ghost text-sm flex items-center gap-2 disabled:opacity-60">
                  {importCsvMutation.isPending ? <LoadingSpinner size="sm" /> : <Upload className="h-4 w-4" />}Importar CSV
                </button>
                <button type="button" onClick={handleDownloadTemplate} className="btn-ghost text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" />Descargar plantilla
                </button>
                <button type="button" onClick={() => exportCsvMutation.mutate()} disabled={exportCsvMutation.isPending} className="btn-ghost text-sm flex items-center gap-2 disabled:opacity-60">
                  {exportCsvMutation.isPending ? <LoadingSpinner size="sm" /> : <Download className="h-4 w-4" />}Exportar CSV
                </button>
              </>
            )}
            <button type="button" onClick={() => setFormUser(null)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />Nuevo Usuario
            </button>
          </div>
        )}
      </div>

      <FilterTable fields={USERS_FILTER_FIELDS_DYNAMIC} values={filters} onChange={handleFilterChange} />

      <div className="card overflow-visible">
        {isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : !data?.data?.length ? (
          <EmptyState icon={Shield} title="Sin usuarios" description="No se encontraron usuarios con los filtros aplicados" />
        ) : (
          <>
            <DataTable<User>
              data={data.data}
              rowKey={(u) => u.id}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(field) => handleSortChange(field as UsersSortBy)}
              columns={[
                {
                  key: 'name',
                  label: 'Usuario',
                  sortable: true,
                  render: (u) => (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-theme-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {u.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">{u.name}</p>
                        <p className="text-xs text-theme-muted truncate">{u.email}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'department',
                  label: 'Departamento',
                  hide: 'md',
                  render: (u) => <span className="text-sm text-theme-secondary">{u.department?.name || '—'}</span>,
                },
                {
                  key: 'branchId',
                  label: 'Sucursal',
                  sortable: true,
                  hide: 'lg',
                  render: (u) => (
                    <span className="text-sm text-theme-secondary">
                      {u.branch ? `${u.branch.name} (${u.branch.code})` : '—'}
                    </span>
                  ),
                },
                {
                  key: 'roleId',
                  label: 'Rol',
                  sortable: true,
                  render: (u) => roleBadge(u.role?.name),
                },
                {
                  key: 'status',
                  label: 'Estado',
                  sortable: true,
                  render: (u) => statusBadge(u.status),
                },
                {
                  key: 'lastLoginAt',
                  label: 'Último acceso',
                  sortable: true,
                  hide: 'lg',
                  render: (u) => (
                    <span className="text-xs text-theme-muted">
                      {u.lastLoginAt ? formatRelative(new Date(u.lastLoginAt), new Date(), { locale: es }) : 'Nunca'}
                    </span>
                  ),
                },
              ]}
              renderActions={(u) => (
                <button
                  onClick={(event: MouseEvent<HTMLButtonElement>) => handleMenuToggle(u.id, event)}
                  className="p-1 rounded hover:bg-theme-surface-muted text-theme-muted"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
            />
            {data?.pagination && (
              <UsersPagination
                page={page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            )}
          </>
        )}
      </div>

      {openMenuUser && menuPosition && (
        <UserActionMenu
          user={openMenuUser}
          isAdmin={isAdmin}
          roleName={roleName}
            canEdit={!isDepartmentManager || openMenuUser.department?.id === currentUser?.departmentId}
          position={menuPosition}
          onClose={() => { setMenuOpenId(null); setMenuPosition(null); }}
          onViewDetail={(u) => setDetailUser(u)}
          onEdit={(u) => setFormUser(u)}
          onResetPassword={(u) => setResetUser(u)}
          onForcePasswordChange={(u) => { forcePasswordChangeMutation.mutate(u.id); setMenuOpenId(null); setMenuPosition(null); }}
          onToggleStatus={(u) => {
            const actionType = u.status === 'active' ? 'lock' : 'activate';
            setConfirmAction({ type: actionType, user: u });
            setMenuOpenId(null);
          }}
          onReactivate={(u) => reactivateMutation.mutate(u.id)}
          onDelete={(u) => setConfirmAction({ type: 'delete', user: u })}
        />
      )}

      {(isAdmin || isGeneralManager || isDepartmentManager) && formUser !== false && (
        <UserFormModal open user={formUser} roleName={roleName} onClose={() => setFormUser(false)} />
      )}
      {isAdmin && resetUser && (
        <ResetPasswordModal open user={resetUser} onClose={() => setResetUser(null)} />
      )}
      <UserProfileModal open={!!detailUser} user={detailUser} onClose={() => setDetailUser(null)} />

      <ImportCsvProgressModal
        open={csvImportState.open}
        fileName={csvImportState.fileName}
        result={csvImportState.result}
        error={csvImportState.error}
        onRetry={handleRetryImport}
        onClose={() => setCsvImportState({ open: false, fileName: '' })}
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.type === 'delete' ? 'Eliminar Usuario' :
          confirmAction?.type === 'lock' ? 'Bloquear Usuario' : 'Activar Usuario'
        }
        description={
          confirmAction?.type === 'delete'
            ? `¿Eliminar la cuenta de "${confirmAction?.user.name}"? Esta acción no se puede deshacer.`
            : confirmAction?.type === 'lock'
            ? `¿Bloquear la cuenta de "${confirmAction?.user.name}"?`
            : `¿Activar la cuenta de "${confirmAction?.user.name}"?`
        }
        confirmLabel={
          confirmAction?.type === 'delete' ? 'Eliminar' :
          confirmAction?.type === 'lock' ? 'Bloquear' : 'Activar'
        }
        loading={deleteMutation.isPending || statusMutation.isPending}
        onConfirm={() => {
          if (!isAdmin) return;
          if (confirmAction?.type === 'delete') deleteMutation.mutate(confirmAction.user.id);
          else if (confirmAction?.type === 'lock') statusMutation.mutate({ id: confirmAction.user.id, status: 'locked' });
          else if (confirmAction?.type === 'activate') statusMutation.mutate({ id: confirmAction.user.id, status: 'active' });
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

import { useCallback, useState, useMemo, useEffect } from 'react';
import {
  useAbsenceById,
  useApproveAbsence,
  useRejectAbsence,
  useCancelAbsence,
} from '@/hooks/useAbsences';
import { useAuthStore } from '@/store/authStore';
import { AbsenceCalendar } from '@/components/absences/AbsenceCalendar';
import { AbsenceDetailModal } from '@/components/absences/AbsenceDetailModal';
import { AbsenceStatusBadge } from '@/components/absences/AbsenceStatusBadge';
import { AbsenceRequestModal } from '@/components/absences/AbsenceRequestModal';
import { AbsenceCreateModal } from '@/components/absences/AbsenceCreateModal';
import { AbsencesSkeleton } from '@/components/common/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Plus, CalendarPlus, Search, Check, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAbsencesData } from '@/hooks/useAbsencesData';
import { useAbsencesPage } from '@/hooks/useAbsencesPage';
import type { AbsenceRequest, AbsenceStatus } from '@/types';
import type { Column } from '@/components/common/DataTable';

type SortField = 'employee' | 'startDate' | 'status' | 'department' | 'branch';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function AbsencesPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.name === 'admin';
  const isGeneralManager = user?.role?.name === 'general_manager';
  const isDepartmentManager = user?.role?.name === 'department_manager';
  const isManager = user?.role?.name === 'admin' || isGeneralManager || isDepartmentManager;
  const isEmployee = !isAdmin && !isGeneralManager && !isDepartmentManager;
  const roleName = user?.role?.name ?? 'employee';
  const userBranchId = user?.branchId;
  const userDepartmentId = user?.departmentId;
  const userId = user?.id ?? '';

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; employeeName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<{ id: string; employeeName: string } | null>(null);
  const [detailAbsenceId, setDetailAbsenceId] = useState<string | null>(null);

  const { availableBranches, scopedBranches, canSelectBranch, departments, branchesQuery, departmentsQuery } = useAbsencesData(user);

  const {
    page,
    setPage,
    pageSize,
    statusFilter,
    branchFilter,
    departmentFilter,
    searchQuery,
    sortBy,
    sortOrder,
    sortedAbsences,
    total,
    totalPages,
    absencesLoading,
    handleSortChange,
    handleStatusFilterChange,
    handleBranchFilterChange,
    handleDepartmentFilterChange,
    handleSearchChange,
  } = useAbsencesPage({ isAdmin, isGeneralManager, canSelectBranch, initialPageSize: 20 });

  const approveMutation = useApproveAbsence();
  const rejectMutation = useRejectAbsence();
  const cancelMutation = useCancelAbsence();
  const branchesLoading = branchesQuery.isLoading;
  const calendarDepartmentsLoading = departmentsQuery.isLoading;
  const tableDepartmentsLoading = departmentsQuery.isLoading;

  const calendarDepartments = useMemo(() => departments.filter((d) => d.isActive), [departments]);
  const tableDepartments = useMemo(() => departments, [departments]);

  const calendarSelectedDepartmentId = useMemo(() => {
    if (!isEmployee) return selectedDepartmentId;
    if (calendarDepartments.length === 1) return calendarDepartments[0].id;
    if (calendarDepartments.length === 0) return '';
    return selectedDepartmentId;
  }, [isEmployee, calendarDepartments, selectedDepartmentId]);

  const handleCalendarBranchChange = useCallback((branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedDepartmentId('');
  }, []);

  

  const {
    data: detailAbsence,
    isPending: detailLoading,
    isError: detailError,
  } = useAbsenceById(detailAbsenceId ?? undefined);

  useEffect(() => {
    if (!detailAbsenceId || !detailError) return;
    toast.error('No se pudo cargar la ausencia');
    const t = window.setTimeout(() => {
      setDetailAbsenceId(null);
    }, 0);
    return () => clearTimeout(t);
  }, [detailAbsenceId, detailError]);

  // `sortedAbsences`, `absences`, `total`, `totalPages`, `absencesLoading` and handlers
  // are provided by `useAbsencesPage` hook above.

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast.success('Ausencia aprobada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo aprobar la ausencia'));
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      await rejectMutation.mutateAsync({ id, rejectionReason: reason });
      toast.success('Ausencia rechazada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo rechazar la ausencia'));
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Solicitud cancelada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cancelar la solicitud'));
    }
  };

  const canApprove = (row: AbsenceRequest) => {
    if (!isManager && !isAdmin) return false;
    if (row.status !== 'pending' && row.status !== 'colindante') return false;
    if (isAdmin) return true;
    if (roleName === 'general_manager' && row.branchId === userBranchId) return true;
    if (roleName === 'department_manager' && row.departmentId === userDepartmentId) return true;
    return false;
  };

  const canCancel = (row: AbsenceRequest) => {
    if (isAdmin) return true;
    if (isManager) {
      if (roleName === 'general_manager' && row.branchId === userBranchId) return true;
      if (roleName === 'department_manager' && row.departmentId === userDepartmentId) return true;
    }
    if (row.employeeId === userId && (row.status === 'pending' || row.status === 'colindante')) return true;
    return false;
  };

  const hasAnyAction = sortedAbsences.some((row) => {
    if (isAdmin) return true;
    if (isManager) {
      const inScope = roleName === 'general_manager' ? row.branchId === userBranchId : row.departmentId === userDepartmentId;
      if (inScope) return true;
    }
    if (row.employeeId === userId && (row.status === 'pending' || row.status === 'colindante')) return true;
    return false;
  });

  const columns: Column<AbsenceRequest>[] = useMemo(() => [
    {
      key: 'employee',
      label: 'Empleado',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="font-medium text-theme-primary">{row.employee.name}</div>
        </div>
      ),
    },
    {
      key: 'startDate',
      label: 'Fechas',
      sortable: true,
      className: 'text-theme-primary whitespace-nowrap',
      render: (row) => `${formatDate(row.startDate)} - ${formatDate(row.endDate)}`,
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (row) => <AbsenceStatusBadge status={row.status} />,
    },
    {
      key: 'department',
      label: 'Departamento',
      sortable: true,
      className: 'text-theme-muted',
      render: (row) => row.department?.name ?? '-',
    },
    {
      key: 'branch',
      label: 'Sucursal',
      sortable: true,
      className: 'text-theme-muted',
      render: (row) => row.branch?.name ?? '-',
    },
  ], []);

  const renderActions = (row: AbsenceRequest) => (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {canApprove(row) && (
        <>
          <button
            type="button"
            onClick={() => handleApprove(row.id)}
            disabled={approveMutation.isPending}
            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
            title="Aprobar"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRejectModal({ id: row.id, employeeName: row.employee.name })}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
            title="Rechazar"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
      {canCancel(row) && (
        <button
          type="button"
          onClick={() => setCancelTarget({ id: row.id, employeeName: row.employee.name })}
          disabled={cancelMutation.isPending}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-600 transition-colors"
          title="Cancelar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const isLoading =
    branchesLoading ||
    calendarDepartmentsLoading ||
    ((isAdmin || isGeneralManager) && tableDepartmentsLoading);

  if (isLoading) {
    return <AbsencesSkeleton />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Ausencias</h1>
          <p className="text-sm text-theme-muted mt-0.5">
            {isAdmin
              ? 'Gestiona las ausencias de todas las sucursales'
              : isManager
                ? 'Gestiona las ausencias de tu equipo'
                : 'Solicita y consulta tus ausencias'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowRequestModal(true)}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Solicitar
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <CalendarPlus className="h-4 w-4" />
              Crear
            </button>
          )}
        </div>
      </div>

      <section className="card p-4">
        <AbsenceCalendar
          branches={scopedBranches}
          departments={calendarDepartments}
          selectedBranchId={selectedBranchId}
          selectedDepartmentId={calendarSelectedDepartmentId}
          onBranchChange={handleCalendarBranchChange}
          onDepartmentChange={setSelectedDepartmentId}
          isAdmin={isAdmin}
          canSelectBranch={canSelectBranch}
          isEmployee={isEmployee}
          userBranchId={userBranchId}
          onAbsenceIdSelect={(id) => setDetailAbsenceId(id)}
        />
      </section>

      <section className="card p-4">
        <h2 className="text-lg font-bold text-theme-primary mb-4">Solicitudes</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            {isAdmin && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-theme-muted">Sucursal</label>
                  <select
                    value={branchFilter}
                    onChange={(e) => handleBranchFilterChange(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">Todas</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-theme-muted">Departamento</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => handleDepartmentFilterChange(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">Todos</option>
                    {tableDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {isGeneralManager && (
              <>
                {canSelectBranch && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-theme-muted">Sucursal</label>
                    <select
                      value={branchFilter}
                      onChange={(e) => handleBranchFilterChange(e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Todas mis sucursales</option>
                      {scopedBranches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-theme-muted">Departamento</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => handleDepartmentFilterChange(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">Todos</option>
                    {tableDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-theme-muted">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value as AbsenceStatus | '')}
                className="input-field text-sm"
              >
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="colindante">Colindante (solapa con equipo)</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-50">
              <label className="text-xs font-medium text-theme-muted">Buscar empleado</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Nombre del empleado..."
                  className="input-field text-sm pl-9 w-full"
                />
              </div>
            </div>
          </div>

          <DataTable<AbsenceRequest>
            data={sortedAbsences}
            columns={columns}
            rowKey={(row) => row.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field) => handleSortChange(field as SortField)}
            isLoading={absencesLoading}
            emptyIcon={Search}
            emptyTitle="Sin solicitudes"
            emptyDescription="No hay solicitudes de ausencia que coincidan con los filtros"
            onRowClick={(row) => setDetailAbsenceId(row.id)}
            renderActions={hasAnyAction ? renderActions : undefined}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-theme-muted">
                Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="btn-secondary text-sm p-2 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-theme-primary font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary text-sm p-2 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h2 className="text-lg font-bold text-theme-primary">
              Rechazar ausencia de {rejectModal.employeeName}
            </h2>
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1">
                Motivo de rechazo *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="input-field w-full resize-none"
                rows={3}
                maxLength={500}
                placeholder="Indica el motivo del rechazo..."
              />
              <p className="text-xs text-theme-muted mt-1 text-right">{rejectReason.length}/500</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setRejectModal(null); setRejectReason(''); }} className="btn-secondary text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rejectModal && rejectReason.trim()) {
                    handleReject(rejectModal.id, rejectReason.trim());
                    setRejectModal(null);
                    setRejectReason('');
                  }
                }}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar solicitud"
        description={
          cancelTarget
            ? `¿Quieres cancelar la solicitud de ausencia de ${cancelTarget.employeeName}?`
            : ''
        }
        confirmLabel="Cancelar solicitud"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelTarget) {
            handleCancel(cancelTarget.id);
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <AbsenceRequestModal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />
      <AbsenceCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      <AbsenceDetailModal
        open={Boolean(detailAbsenceId)}
        onClose={() => setDetailAbsenceId(null)}
        absence={detailAbsence ?? null}
        isLoading={Boolean(detailAbsenceId) && detailLoading}
        canApprove={detailAbsence ? canApprove(detailAbsence) : false}
        canCancel={detailAbsence ? canCancel(detailAbsence) : false}
        isActionPending={
          approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending
        }
        onApprove={async (id) => {
          await handleApprove(id);
          setDetailAbsenceId(null);
        }}
        onReject={(id) => {
          const name = detailAbsence?.employee.name ?? '';
          setRejectModal({ id, employeeName: name });
          setDetailAbsenceId(null);
        }}
        onCancel={(id) => {
          const name = detailAbsence?.employee.name ?? '';
          setCancelTarget({ id, employeeName: name });
          setDetailAbsenceId(null);
        }}
      />
    </div>
  );
}

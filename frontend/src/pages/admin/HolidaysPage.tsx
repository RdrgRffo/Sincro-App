import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Filter, Pencil, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ListPageSkeleton } from '@/components/common/Skeleton';
import { DataTable } from '@/components/common/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { HolidayCreateModal } from '@/components/branches/HolidayCreateModal';
import { HolidayEditModal } from '@/components/schedule/HolidayEditModal';
import { getApiErrorMessage } from '@/lib/apiError';
import { getEffectiveBranchId } from '@/lib/branchSelection';
import { useAuthStore } from '@/store/authStore';
import type { Branch, BranchHoliday, GroupedBranchHoliday } from '@/types';

type HolidayType = BranchHoliday['type'];

const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  nacional: 'Nacional',
  autonomica: 'Autonómica',
  local: 'Local',
  mejora: 'Mejora',
  regional: 'Regional',
  company: 'Empresa',
};

const HOLIDAY_TYPE_COLORS: Record<HolidayType, string> = {
  nacional: '#dc2626',
  autonomica: '#ea580c',
  local: '#d97706',
  mejora: '#65a30d',
  regional: '#0ea5e9',
  company: '#7c3aed',
};

const HOLIDAY_TYPE_FILTERS: Array<{ value: 'all' | HolidayType; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'nacional', label: 'Nacional' },
  { value: 'autonomica', label: 'Autonómica' },
  { value: 'regional', label: 'Regional' },
  { value: 'local', label: 'Local' },
  { value: 'mejora', label: 'Mejora' },
  { value: 'company', label: 'Empresa' },
];

type DisplayHoliday = BranchHoliday | GroupedBranchHoliday;

function isGrouped(h: DisplayHoliday): h is GroupedBranchHoliday {
  return 'branches' in h && Array.isArray((h as GroupedBranchHoliday).branches);
}

export function HolidaysPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const roleName = currentUser?.role?.name ?? '';
  const isAdmin = roleName === 'admin';
  const isGeneralManager = roleName === 'general_manager';
  const canManageHolidays = isAdmin || isGeneralManager;

  const [selectedBranchId, setSelectedBranchId] = useState<string>(isGeneralManager && currentUser?.branchId ? currentUser.branchId : '');
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [holidayTypeFilter, setHolidayTypeFilter] = useState<'all' | HolidayType>('all');
  const [holidayToDelete, setHolidayToDelete] = useState<DisplayHoliday | null>(null);
  const [holidayToEdit, setHolidayToEdit] = useState<DisplayHoliday | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [branchesModal, setBranchesModal] = useState<GroupedBranchHoliday | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: branches, isLoading: branchesLoading } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'holidays-page'],
    queryFn: () =>
      api
        .get('/branches', { params: { includeInactive: true } })
        .then((r) => r.data),
  });

  const branchList = branches?.data ?? [];
  const hasBranches = branchList.length > 0;
  const showAllBranches = selectedBranchId === 'all';

  const effectiveSelectedBranchId = showAllBranches
    ? 'all'
    : getEffectiveBranchId({
        branches: branchList,
        selectedBranchId,
        fallbackStrategy: 'active-or-first',
      });

  const selectedBranch = showAllBranches ? null : branches?.data.find((branch) => branch.id === effectiveSelectedBranchId);

  const { data: holidays, isLoading: holidaysLoading } = useQuery<{ data: DisplayHoliday[] }>({
    queryKey: ['branch-holidays', effectiveSelectedBranchId, holidayYear],
    queryFn: () => {
      const params: Record<string, unknown> = { year: holidayYear };
      if (showAllBranches) {
        params.groupShared = true;
      }
      return api
        .get(`/branches/${effectiveSelectedBranchId}/holidays`, { params })
        .then((r) => r.data);
    },
    enabled: Boolean(effectiveSelectedBranchId),
  });

  const filteredHolidays = useMemo(() => {
    const source = holidays?.data ?? [];
    const filtered = holidayTypeFilter === 'all' ? source : source.filter((h) => h.type === holidayTypeFilter);
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      } else if (sortBy === 'type') {
        cmp = a.type.localeCompare(b.type, 'es');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [holidays?.data, holidayTypeFilter, sortBy, sortOrder]);

  const deleteHolidayMutation = useMutation({
    mutationFn: (holiday: DisplayHoliday) => {
      if (isGrouped(holiday)) {
        return api.delete(`/branches/${effectiveSelectedBranchId}/holidays/bulk`, {
          data: { holidayIds: holiday.holidayIds },
        });
      }
      return api.delete(`/branches/${effectiveSelectedBranchId}/holidays/${holiday.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-holidays'] });
      qc.invalidateQueries({ queryKey: ['branch-holidays-calendar'] });
      toast.success('Festivo eliminado');
      setHolidayToDelete(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo eliminar el festivo')),
  });


  if (!canManageHolidays) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">Festivos</h1>
            <p className="text-sm text-theme-muted mt-0.5">
              Configura festivos por sucursal de forma independiente
            </p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <CalendarDays className="h-12 w-12 mx-auto text-theme-muted mb-3" />
          <h2 className="text-lg font-semibold text-theme-primary mb-1">Sin acceso</h2>
          <p className="text-sm text-theme-muted">
            No tienes permisos para gestionar festivos. Contacta con un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Festivos</h1>
          <p className="text-sm text-theme-muted mt-0.5">
            Configura festivos por sucursal de forma independiente
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo festivo
        </button>
      </div>

      <section className="card p-4 space-y-4">
        {!hasBranches ? (
          <EmptyState icon={CalendarDays} title="Sin sucursales" description="Crea una sucursal para poder configurar festivos" />
        ) : !effectiveSelectedBranchId ? (
          <EmptyState icon={CalendarDays} title="Selecciona una sucursal" description="Elige una sucursal para gestionar sus festivos" />
        ) : (
          <>
            {selectedBranch && !selectedBranch.isActive && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                Estás configurando una sucursal inactiva.
              </p>
            )}

            {/* Fila de filtros: dos columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Columna izquierda: selector sucursal */}
              <div className="border border-theme-color rounded-xl p-3 bg-theme-surface-muted/40 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" />Filtros
                </span>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
                    Sucursal
                  </label>
                  {branchesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-theme-muted"><LoadingSpinner size="sm" />Cargando sucursales…</div>
                  ) : isGeneralManager ? (
                    <div className="text-sm text-theme-primary font-medium px-3 py-2 bg-theme-surface-muted rounded-lg">
                      {branches?.data?.find((b) => b.id === currentUser?.branchId)?.name ?? 'Mi sucursal'}
                    </div>
                  ) : (
                    <select
                      value={effectiveSelectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="input-field text-sm w-full"
                    >
                      <option value="all">Todas las sucursales</option>
                      {(branches?.data ?? []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code}){branch.isActive ? '' : ' · inactiva'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Columna derecha: filtros año + tipo */}
              <div className="border border-theme-color rounded-xl p-3 bg-theme-surface-muted/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Año</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHolidayYear((prev) => Math.max(2000, prev - 1))}
                      className="p-1.5 rounded-lg border border-theme-color text-theme-muted hover:text-theme-primary hover:bg-theme-surface"
                      title="Año anterior"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={holidayYear}
                      onChange={(e) => setHolidayYear(Number(e.target.value) || new Date().getFullYear())}
                      className="input-field text-sm w-24 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setHolidayYear((prev) => Math.min(2100, prev + 1))}
                      className="p-1.5 rounded-lg border border-theme-color text-theme-muted hover:text-theme-primary hover:bg-theme-surface"
                      title="Año siguiente"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" />Tipo de festivo
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {HOLIDAY_TYPE_FILTERS.map((option) => {
                      const active = holidayTypeFilter === option.value;
                      const tone = option.value === 'all' ? '#475569' : HOLIDAY_TYPE_COLORS[option.value as HolidayType];
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setHolidayTypeFilter(option.value)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                          style={
                            active
                              ? { backgroundColor: tone, borderColor: tone, color: '#fff' }
                              : { backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border-color)', color: 'var(--theme-text-muted)' }
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {holidaysLoading ? (
              <ListPageSkeleton />
            ) : !holidays?.data?.length ? (
              <EmptyState icon={CalendarDays} title="Sin festivos" description="No hay festivos cargados para este año" />
            ) : !filteredHolidays.length ? (
              <EmptyState icon={Filter} title="Sin resultados" description="No hay festivos para el tipo seleccionado" />
            ) : (
              <DataTable<DisplayHoliday>
                data={filteredHolidays}
                rowKey={(h) => h.id}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={(field) => {
                  if (sortBy === field) {
                    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortBy(field as 'date' | 'name' | 'type');
                    setSortOrder('asc');
                  }
                }}
                columns={[
                  {
                    key: 'date',
                    label: 'Fecha',
                    sortable: true,
                    render: (h) => (
                      <span className="text-sm text-theme-primary">{format(new Date(h.date), 'dd/MM/yyyy')}</span>
                    ),
                  },
                  {
                    key: 'name',
                    label: 'Nombre',
                    sortable: true,
                    render: (h) => <span className="text-sm text-theme-primary">{h.name}</span>,
                  },
                  ...(showAllBranches
                    ? [
                        {
                          key: 'branch' as string,
                          label: 'Sucursal',
                          render: (h: DisplayHoliday) =>
                            isGrouped(h) ? (
                              h.branches.length === 1 ? (
                                <span className="text-xs text-theme-muted">
                                  {h.branches[0].name} ({h.branches[0].code})
                                </span>
                              ) : (
                                <button
                                  onClick={() => setBranchesModal(h)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-theme-primary bg-theme-surface-muted hover:bg-theme-surface-muted/80 rounded-full px-2 py-0.5 transition-colors"
                                >
                                  <Building2 className="h-3 w-3" />
                                  {h.sharedCount} sucursales
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-theme-muted">
                                {(h as BranchHoliday).branch?.name ?? '—'}
                              </span>
                            ),
                        },
                      ]
                    : []),
                  {
                    key: 'type',
                    label: 'Tipo',
                    sortable: true,
                    render: (h) => (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold"
                        style={{ backgroundColor: HOLIDAY_TYPE_COLORS[h.type] }}
                      >
                        {HOLIDAY_TYPE_LABELS[h.type]}
                      </span>
                    ),
                  },
                ]}
                renderActions={(h) => (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setHolidayToEdit(h)}
                      className="p-1.5 rounded-lg hover:bg-theme-surface-muted text-theme-muted hover:text-theme-primary"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setHolidayToDelete(h)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              />
            )}
          </>
        )}
      </section>

      {/* Modal de sucursales para festivos compartidos */}
      {branchesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={() => setBranchesModal(null)}>
          <div className="card rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-theme-color">
              <div>
                <h3 className="text-base font-semibold text-theme-primary">{branchesModal.name}</h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  {format(new Date(branchesModal.date), 'dd/MM/yyyy')} · {HOLIDAY_TYPE_LABELS[branchesModal.type]}
                </p>
              </div>
              <button onClick={() => setBranchesModal(null)} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
                Sucursales ({branchesModal.sharedCount})
              </p>
              {branchesModal.branches.map((b) => (
                <div key={b.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-surface-muted/60">
                  <Building2 className="h-4 w-4 text-theme-muted shrink-0" />
                  <span className="text-sm text-theme-primary">{b.name}</span>
                  <span className="text-xs text-theme-muted">({b.code})</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end px-5 py-3 border-t border-theme-color">
              <button onClick={() => setBranchesModal(null)} className="btn-ghost text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <HolidayCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        defaultBranchId={showAllBranches ? undefined : effectiveSelectedBranchId}
      />

      <HolidayEditModal
        open={!!holidayToEdit}
        holiday={holidayToEdit}
        branchName={showAllBranches ? undefined : selectedBranch?.name}
        onClose={() => setHolidayToEdit(null)}
      />

      <ConfirmDialog
        open={!!holidayToDelete}
        title="Eliminar festivo"
        description={`¿Quieres eliminar "${holidayToDelete?.name ?? ''}"?`}
        confirmLabel="Eliminar"
        loading={deleteHolidayMutation.isPending}
        onConfirm={() => holidayToDelete && deleteHolidayMutation.mutate(holidayToDelete)}

        onCancel={() => setHolidayToDelete(null)}
      />
    </div>
  );
}

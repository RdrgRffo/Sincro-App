import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { useScheduleTypes } from '@/hooks/useScheduleTypes';
import api from '@/config/api';
import { formatDateTime } from '@/lib/utils';
import { format, getISOWeek, getISOWeekYear, startOfWeek, endOfWeek } from 'date-fns';
import type { WeekScheduleItem, WeekScheduleAssignee, ScheduleType, Branch, Department, User } from '@/types';


const ITEMS_PER_PAGE = 5;

function getTypeLabel(type: string, scheduleTypes: ScheduleType[]) {
  return scheduleTypes.find((t) => t.value === type)?.label || type;
}

function getTypeColor(type: string, scheduleTypes: ScheduleType[]) {
  return scheduleTypes.find((t) => t.value === type)?.color || '#1e3a5f';
}

interface WeekSchedulesWidgetProps {
  onOpenProfile: (user: WeekScheduleAssignee) => void;
}

/**
 * @description Widget de turnos de la semana con paginación inline y filtros rápidos.
 * Los filtros disponibles dependen del rol:
 * - admin: branch + department + employee
 * - general_manager: department (de su branch) + employee
 * - department_manager: employee (de su depto)
 * - employee: department (de su branch)
 */
export function WeekSchedulesWidget({ onOpenProfile }: WeekSchedulesWidgetProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { types: scheduleTypes = [] } = useScheduleTypes();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const isoWeek = getISOWeek(now);
  const isoWeekYear = getISOWeekYear(now);

  const roleName = user?.role?.name;
  const isAdmin = roleName === 'admin';
  const isGeneralManager = roleName === 'general_manager';
  const isDepartmentManager = roleName === 'department_manager';
  const isEmployee = roleName === 'employee';

  // --- Filtros interactivos ---
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyUrgent, setOnlyUrgent] = useState(false);

  // --- Cargar branches (solo admin) ---
  const { data: branchesData } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'widget'],
    queryFn: () => api.get('/branches').then((r) => r.data),
    enabled: isAdmin,
  });
  const branches = branchesData?.data ?? [];

  // --- Cargar departments según branch seleccionada ---
  const effectiveBranchId = isAdmin
    ? selectedBranchId
    : isGeneralManager
      ? (user?.branchId ?? '')
      : isDepartmentManager
        ? ''
        : isEmployee
          ? (user?.branchId ?? '')
          : '';

  const { data: departmentsData } = useQuery<{ data: Department[] }>({
    queryKey: ['departments', 'widget', effectiveBranchId],
    queryFn: () =>
      api
        .get('/departments', {
          params: { includeInactive: false, branchId: effectiveBranchId || undefined },
        })
        .then((r) => r.data),
    enabled: Boolean(effectiveBranchId) || isAdmin,
  });
  const departments = departmentsData?.data ?? [];

  // --- Cargar usuarios según departamento seleccionado ---
  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users', 'widget', selectedDeptId || effectiveBranchId],
    queryFn: () => {
      const params: Record<string, string> = { status: 'active', limit: '200' };
      if (selectedDeptId) params.departmentId = selectedDeptId;
      else if (effectiveBranchId) params.branchId = effectiveBranchId;
      return api.get('/users', { params }).then((r) => r.data);
    },
    enabled: isAdmin || isGeneralManager || isDepartmentManager,
  });
  const users = usersData?.data ?? [];

  // --- Query params para el endpoint ---
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};

    // Filtro automático por rol (branch/department base)
    if (isDepartmentManager && user?.department?.id && !selectedDeptId) {
      params.departmentId = user.department.id;
    } else if (isGeneralManager && user?.branchId && !selectedBranchId) {
      params.branchId = user.branchId;
    } else if (isEmployee && user?.branchId) {
      params.branchId = user.branchId;
    }

    // Filtros interactivos (sobrescriben los automáticos)
    if (selectedBranchId) params.branchId = selectedBranchId;
    if (selectedDeptId) params.departmentId = selectedDeptId;
    if (selectedUserId) params.userId = selectedUserId;

    return params;
  }, [
    user,
    selectedBranchId,
    selectedDeptId,
    selectedUserId,
    isDepartmentManager,
    isGeneralManager,
    isEmployee,
  ]);

  const { data: weekSchedules, isLoading } = useQuery({
    queryKey: ['schedules', 'week', isoWeekYear, isoWeek, queryParams],
    queryFn: () => {
      const searchParams = new URLSearchParams(queryParams);
      const qs = searchParams.toString();
      const url = `/schedules/week/${isoWeekYear}/${isoWeek}${qs ? `?${qs}` : ''}`;
      return api
        .get<{ data: { items: WeekScheduleItem[] } }>(url)
        .then((r) => r.data.data.items);
    },
  });

  // --- Filtros locales (tipo, solo míos, urgentes) ---
  const filteredSchedules = useMemo(() => {
    if (!weekSchedules) return [];
    return weekSchedules.filter((s) => {
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (onlyMine && !s.assignees.some((a) => a.id === user?.id)) return false;
      if (onlyUrgent && !s.isLastMinute) return false;
      return true;
    });
  }, [weekSchedules, filterType, onlyMine, onlyUrgent, user?.id]);

  // --- Paginación ---
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredSchedules.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    setter(value);
    setPage(1);
  };

  // Tipos únicos para el filtro
  const uniqueTypes = useMemo(() => {
    if (!weekSchedules) return [];
    const seen = new Set<string>();
    return weekSchedules.filter((s) => {
      if (seen.has(s.type)) return false;
      seen.add(s.type);
      return true;
    });
  }, [weekSchedules]);

  const showBranchFilter = isAdmin;
  const showDeptFilter = isAdmin || isGeneralManager || isEmployee;
  const showUserFilter = isAdmin || isGeneralManager || isDepartmentManager;

  return (
    <div className="card p-7 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-600" />
          Turnos de esta semana
        </h2>
        <span className="text-xs text-theme-muted">
          {format(weekStart, 'dd/MM')} — {format(weekEnd, 'dd/MM')}
        </span>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <Filter className="h-3.5 w-3.5 text-theme-muted" />

        {/* Branch filter (solo admin) */}
        {showBranchFilter && (
          <select
            value={selectedBranchId}
            onChange={(e) => {
              handleFilterChange(setSelectedBranchId)(e.target.value);
              setSelectedDeptId('');
              setSelectedUserId('');
            }}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        {/* Department filter */}
        {showDeptFilter && departments.length > 0 && (
          <select
            value={selectedDeptId}
            onChange={(e) => {
              handleFilterChange(setSelectedDeptId)(e.target.value);
              setSelectedUserId('');
            }}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}

        {/* Employee filter */}
        {showUserFilter && users.length > 0 && (
          <select
            value={selectedUserId}
            onChange={(e) => handleFilterChange(setSelectedUserId)(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-[160px]"
          >
            <option value="">Todos los empleados</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}

        {/* Active filters indicator */}
        {(selectedBranchId || selectedDeptId || selectedUserId) && (
          <button
            type="button"
            onClick={() => {
              setSelectedBranchId('');
              setSelectedDeptId('');
              setSelectedUserId('');
              setPage(1);
            }}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title="Limpiar filtros"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}

        <select
          value={filterType}
          onChange={(e) => handleFilterChange(setFilterType)(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          <option value="all">Todos los tipos</option>
          {uniqueTypes.map((s) => (
            <option key={s.type} value={s.type}>
              {getTypeLabel(s.type, scheduleTypes)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => handleFilterChange(setOnlyMine)(e.target.checked)}
            className="rounded border-gray-300 text-gray-600 focus:ring-gray-400"
          />
          Solo mis turnos
        </label>

        <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyUrgent}
            onChange={(e) => handleFilterChange(setOnlyUrgent)(e.target.checked)}
            className="rounded border-gray-300 text-gray-600 focus:ring-gray-400"
          />
          Solo urgentes
        </label>

        <span className="text-xs text-theme-muted ml-auto">
          {filteredSchedules.length} turnos
        </span>
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 text-theme-muted mx-auto mb-2" />
            <p className="text-sm text-theme-muted">
              {filterType !== 'all' || onlyMine || onlyUrgent || selectedBranchId || selectedDeptId || selectedUserId
                ? 'No hay turnos que coincidan con los filtros'
                : 'No hay turnos programados esta semana'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/schedule/${s.id}`, {
                    state: { initialView: 'dayGridMonth', initialDate: s.startDatetime },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/schedule/${s.id}`, {
                      state: { initialView: 'dayGridMonth', initialDate: s.startDatetime },
                    });
                  }
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer text-left w-full"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getTypeColor(s.type, scheduleTypes) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{s.title}</p>
                  <p className="text-xs text-theme-muted">
                    {formatDateTime(s.startDatetime)} — {format(new Date(s.endDatetime), 'HH:mm')}
                  </p>
                </div>
                <div className="flex -space-x-1 shrink-0">
                  {s.assignees.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      title={a.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile(a);
                      }}
                      className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-300 transition-colors"
                    >
                      {a.name[0]}
                    </div>
                  ))}
                  {s.assignees.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-500">
                      +{s.assignees.length - 3}
                    </div>
                  )}
                </div>
                {s.isLastMinute && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                    Urgente
                  </span>
                )}
                <span
                  className="text-xs px-2 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: getTypeColor(s.type, scheduleTypes) }}
                >
                  {getTypeLabel(s.type, scheduleTypes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-gray-100">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-theme-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>

          <span className="text-xs text-theme-muted">
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-theme-primary"
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

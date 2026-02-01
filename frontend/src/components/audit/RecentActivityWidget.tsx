import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import api from '@/config/api';
import { formatRelative } from '@/lib/utils';
import type { AuditLog, PaginatedResponse } from '@/types';

const ITEMS_PER_PAGE = 10;

const IRREVERSIBLE_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'CHANGE_PASSWORD',
  'RESET_PASSWORD',
  'FAILED_LOGIN_ATTEMPT',
  'ROLLBACK_PERFORMED',
];

const ACTION_OPTIONS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'CREATE_SCHEDULE', label: 'Crear turno' },
  { value: 'UPDATE_SCHEDULE', label: 'Modificar turno' },
  { value: 'DELETE_SCHEDULE', label: 'Eliminar turno' },
  { value: 'LOGIN', label: 'Inicio sesión' },
  { value: 'LOGOUT', label: 'Cierre sesión' },
  { value: 'CHANGE_PASSWORD', label: 'Cambio contraseña' },
  { value: 'CREATE_USER', label: 'Crear usuario' },
  { value: 'UPDATE_USER', label: 'Modificar usuario' },
  { value: 'DELETE_USER', label: 'Eliminar usuario' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'Todas las entidades' },
  { value: 'Schedule', label: 'Turno' },
  { value: 'User', label: 'Usuario' },
  { value: 'Branch', label: 'Sucursal' },
  { value: 'Role', label: 'Rol' },
  { value: 'ScheduleType', label: 'Tipo de turno' },
  { value: 'Setting', label: 'Configuración' },
];

const TIME_RANGE_OPTIONS = [
  { value: '', label: 'Todo el tiempo' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
];

function getTimeRangeDates(range: string): { from?: string; to?: string } {
  if (!range) return {};
  const now = new Date();
  const to = now.toISOString();

  if (range === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return { from, to };
  }
  if (range === 'week') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }
  if (range === 'month') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }
  return {};
}

/**
 * @description Widget de actividad reciente con paginación y filtros rápidos.
 */
export function RecentActivityWidget() {
  const navigate = useNavigate();

  // --- Filtros ---
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterTimeRange, setFilterTimeRange] = useState('');
  const [onlyReversible, setOnlyReversible] = useState(false);

  // --- Paginación ---
  const [page, setPage] = useState(1);

  const timeRange = getTimeRangeDates(filterTimeRange);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('limit', String(ITEMS_PER_PAGE));
  if (filterAction) queryParams.set('action', filterAction);
  if (filterEntity) queryParams.set('entityType', filterEntity);
  if (timeRange.from) queryParams.set('from', timeRange.from);
  if (timeRange.to) queryParams.set('to', timeRange.to);
  if (onlyReversible) queryParams.set('reversible', 'true');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'widget', page, filterAction, filterEntity, filterTimeRange, onlyReversible],
    queryFn: () =>
      api
        .get<PaginatedResponse<AuditLog>>(`/audit?${queryParams.toString()}`)
        .then((r) => r.data),
  });

  const logs = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="card p-7 flex flex-col h-full">


      {/* Header */}
      <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2 mb-4 shrink-0">
        <Clock className="h-4 w-4 text-gray-600" />
        Actividad Reciente
      </h2>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-gray-100 shrink-0">
        <Filter className="h-3.5 w-3.5 text-theme-muted" />

        <select
          value={filterAction}
          onChange={(e) => handleFilterChange(setFilterAction)(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-[140px]"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filterEntity}
          onChange={(e) => handleFilterChange(setFilterEntity)(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-[140px]"
        >
          {ENTITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filterTimeRange}
          onChange={(e) => handleFilterChange(setFilterTimeRange)(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyReversible}
            onChange={(e) => handleFilterChange(setOnlyReversible)(e.target.checked)}
            className="rounded border-gray-300 text-gray-600 focus:ring-gray-400"
          />
          Solo reversibles
        </label>
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto schedule-sidebar-scroll">

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-theme-muted text-center py-8">
            {filterAction || filterEntity || filterTimeRange || onlyReversible
              ? 'No hay actividad que coincida con los filtros'
              : 'Sin actividad reciente'}
          </p>
        ) : (
          <div className="space-y-2">


            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer text-left group"
                onClick={() => {
                  const isIrreversible = IRREVERSIBLE_ACTIONS.includes(log.action);
                  navigate('/admin/audit', {
                    state: {
                      selectedLogId: log.id,
                      activeTab: isIrreversible ? 'irreversible' : 'reversible',
                    },
                  });
                }}
              >
                <div className="h-2 w-2 rounded-full bg-gray-400 mt-0.5 shrink-0 group-hover:scale-125 transition-all" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary group-hover:text-gray-800 transition-colors truncate">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-theme-muted mt-0.5">
                    {log.user?.name || 'Sistema'} · {formatRelative(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-gray-100 shrink-0">
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

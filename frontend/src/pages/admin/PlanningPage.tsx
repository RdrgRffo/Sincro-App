import { useState } from 'react';
import { Bell, CalendarClock, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/common/PageHeader';
import { PlanningSkeleton } from '@/components/common/Skeleton';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { pageMeta } from '@/config/pageMeta';
import {
  type PlanningFilters as FiltersType,
  type NotificationPreferences,
  type CoverageRiskItem,

  usePlanningLookups,
  useCoverageRisks,
  useAvailabilityMatrix,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/usePlanning';

import { PlanningFilters } from '@/components/planning/PlanningFilters';
import { PlanningSummaryCards } from '@/components/planning/PlanningSummaryCards';
import { PlanningMatrix } from '@/components/planning/PlanningMatrix';
import { PlanningSidePanels } from '@/components/planning/PlanningSidePanels';
import { RiskAssignmentModal } from '@/components/planning/RiskAssignmentModal';

function defaultFilters(userRole?: string, userDepartmentId?: string | null): FiltersType {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  // DM users start with their department pre-selected
  if (userRole === 'department_manager' && userDepartmentId) {
    return { from, to, departmentId: userDepartmentId };
  }
  return { from, to };
}

export function PlanningPage() {
  const user = useAuthStore((s) => s.user);
  const [filters, setFilters] = useState<FiltersType>(() =>
    defaultFilters(user?.role?.name, user?.departmentId),
  );
  const [assigningRisk, setAssigningRisk] = useState<CoverageRiskItem | null>(null);

  const roleName = user?.role?.name ?? '';
  const isAdmin = roleName === 'admin';
  const isGM = roleName === 'general_manager';
  const isDM = roleName === 'department_manager';
  const userDepartmentId = user?.departmentId ?? null;
  const userBranchId = user?.branchId ?? null;

  // DM permission to view other departments
  const canViewOtherDepartments = user?.permissions?.includes('departments:view') ?? false;

  // ── Loading state ─────────────────────────────────────────────────────────
  const lookupsQuery = usePlanningLookups(filters.branchId);
  const risksQuery = useCoverageRisks(filters);
  const matrixQuery = useAvailabilityMatrix(filters);
  const preferencesQuery = useNotificationPreferences();

  const isInitialLoading =
    lookupsQuery.isLoading ||
    risksQuery.isLoading ||
    matrixQuery.isLoading ||
    preferencesQuery.isLoading;

  // 3.4: Track individual query errors
  const hasError = risksQuery.isError || matrixQuery.isError || lookupsQuery.isError;

  // ── Lookups ──────────────────────────────────────────────────────────────
  const { data: lookups } = lookupsQuery;
  const branches = (lookups?.branches ?? []).filter(
    (b) => isAdmin || [userBranchId, ...(user?.visibleBranches?.map((vb) => vb.branch.id) ?? [])].includes(b.id),
  );
  const departments = lookups?.departments ?? [];

  // ── Planning data ─────────────────────────────────────────────────────────
  const { data: risks } = risksQuery;
  const { data: matrix } = matrixQuery;
  const { data: preferences } = preferencesQuery;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updatePreference = useUpdateNotificationPreferences();

  const handleTogglePreference = (patch: Partial<NotificationPreferences>) => {
    updatePreference.mutate(patch, {
      onError: (err) => toast.error(getApiErrorMessage(err, 'No se pudo guardar el aviso')),
    });
  };

  const planningMeta = pageMeta['/planning'];

  // ── Scope indicator ───────────────────────────────────────────────────────
  const scopeLabel = isAdmin
    ? 'Administrador · Acceso completo'
    : isGM
      ? `Gerente General · Sede: ${user?.branch?.name ?? '—'}`
      : isDM
        ? `Responsable · ${user?.department?.name ?? '—'}`
        : '';

  if (isInitialLoading) {
    return <PlanningSkeleton />;
  }

  // 3.4: Show error state with retry option
  if (hasError) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader title={planningMeta.title} subtitle={planningMeta.subtitle} />
        <div className="card p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">Error al cargar datos</h3>
          <p className="text-sm text-slate-500 mb-4">
            No se pudieron cargar algunos datos de planificación. Intenta de nuevo.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                risksQuery.refetch();
                matrixQuery.refetch();
                lookupsQuery.refetch();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
          {risksQuery.error && (
            <p className="text-xs text-red-500 mt-3">
              {getApiErrorMessage(risksQuery.error, 'Error en riesgos')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title={planningMeta.title} subtitle={planningMeta.subtitle} />

      {/* Scope indicator */}
      <div className="flex items-center gap-2 px-1">
        <Info className="h-4 w-4 text-theme-muted" />
        <span className="text-xs text-theme-muted font-medium">{scopeLabel}</span>
        {isDM && !canViewOtherDepartments && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            Solo mi departamento
          </span>
        )}
        {isDM && canViewOtherDepartments && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            Visión multi-departamento
          </span>
        )}
        {isGM && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            Mi sede
          </span>
        )}
      </div>

      {/* Filters row */}
      <PlanningFilters
        filters={filters}
        branches={branches}
        departments={departments}
        onChange={setFilters}
        roleName={roleName}
        userDepartmentId={userDepartmentId}
        userBranchId={userBranchId}
        canViewOtherDepartments={canViewOtherDepartments}
      />

      {/* KPI summary cards */}
      <PlanningSummaryCards
        risks={risks}
      />

      {/* Notification preferences + Availability matrix (compacto) */}
      <section className="card p-4 space-y-3">
        {/* Notification preferences - horizontal compact */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-2 shrink-0">
            <Bell className="h-4 w-4 text-theme-muted" />
            <h2 className="text-sm font-bold text-theme-primary whitespace-nowrap">Mis avisos</h2>
          </div>
          {preferences &&
            (
              [
                ['scheduleChanges', 'Cambios turnos'],
                ['absenceUpdates', 'Ausencias'],
                ['departmentAbsenceRequests', 'Solicitudes depto.'],
                ['dailySummary', 'Resumen diario'],
                ['weeklySummary', 'Resumen semanal'],
                ['criticalAlertsOnly', 'Solo críticas'],
              ] as Array<[keyof NotificationPreferences, string]>
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-theme-muted whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(e) => handleTogglePreference({ [key]: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-theme-color"
                />
                {label}
              </label>
            ))}
        </div>

        {/* Availability matrix */}
        <div className="overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-theme-muted" />
            <h2 className="text-sm font-bold text-theme-primary">Mapa de disponibilidad</h2>
          </div>
          <PlanningMatrix matrix={matrix} />
        </div>
      </section>

      {/* Risks - ancho completo como la matriz */}
      <section className="card p-4">
        <PlanningSidePanels
          risks={risks}
          onAssignRisk={(risk) => setAssigningRisk(risk)}
        />
      </section>


      {/* Risk Assignment Modal */}
      <RiskAssignmentModal
        risk={assigningRisk}
        onClose={() => setAssigningRisk(null)}
      />
    </div>
  );
}

export default PlanningPage;

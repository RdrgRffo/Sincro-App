import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTeamWeeklySummaries } from '@/hooks/useTeamWeeklySummaries';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';
import { Clock, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * @description Tarjeta que muestra el resumen semanal de horas del equipo.
 * Se renderiza en el DashboardPage para admin, general_manager y department_manager.
 */
export function TeamWeeklySummaryCard() {
  const user = useAuthStore((s) => s.user);
  const now = new Date();
  const isoWeek = getISOWeek(now);
  const isoWeekYear = getISOWeekYear(now);

  const roleName = user?.role?.name;

  // department_manager: solo ve su departamento
  // general_manager: solo ve su sucursal
  // admin: ve todo
  const filters = useMemo(() => {
    if (roleName === 'department_manager') {
      return { departmentId: user?.department?.id };
    }
    if (roleName === 'general_manager') {
      return { branchId: user?.branchId ?? undefined };
    }
    return undefined;
  }, [roleName, user?.department?.id, user?.branchId]);

  const { data: summaries, isLoading } = useTeamWeeklySummaries(isoWeekYear, isoWeek, filters);

  const stats = useMemo(() => {
    if (!summaries || summaries.length === 0) return null;

    const totalHours = summaries.reduce((acc, s) => acc + s.totalHours, 0);
    const totalOvertime = summaries.reduce((acc, s) => acc + s.overtimeHours, 0);
    const membersWithOvertime = summaries.filter((s) => s.overtimeHours > 0).length;
    const avgHours = summaries.length > 0 ? Math.round((totalHours / summaries.length) * 10) / 10 : 0;

    return {
      totalMembers: summaries.length,
      totalHours: Math.round(totalHours * 10) / 10,
      totalOvertime: Math.round(totalOvertime * 10) / 10,
      membersWithOvertime,
      avgHours,
    };
  }, [summaries]);

  const canView = roleName === 'admin' || roleName === 'general_manager' || roleName === 'department_manager';
  if (!canView) return null;

  return (
    <div className="card p-7">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-600" />
          Resumen semanal del equipo
        </h2>
        <span className="text-xs text-theme-muted">
          Semana {isoWeek} · {format(now, "MMMM yyyy", { locale: es })}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : !stats ? (
        <div className="text-center py-8">
          <Users className="h-10 w-10 text-theme-muted mx-auto mb-2" />
          <p className="text-sm text-theme-muted">No hay datos de resumen semanal disponibles</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Métricas principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Miembros</p>
              <p className="text-xl font-bold text-theme-primary mt-1">{stats.totalMembers}</p>
            </div>
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Horas totales</p>
              <p className="text-xl font-bold text-theme-primary mt-1">{stats.totalHours}h</p>
            </div>
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Media por persona</p>
              <p className="text-xl font-bold text-theme-primary mt-1">{stats.avgHours}h</p>
            </div>
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Horas extra</p>
              <p className={`text-xl font-bold mt-1 ${stats.totalOvertime > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {stats.totalOvertime}h
              </p>
            </div>
          </div>

          {/* Alerta de horas extra */}
          {stats.membersWithOvertime > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>{stats.membersWithOvertime}</strong> miembro{stats.membersWithOvertime !== 1 ? 's' : ''} ha{stats.membersWithOvertime === 1 ? '' : 'n'} registrado{stats.membersWithOvertime === 1 ? '' : 's'} horas extra esta semana
              </p>
            </div>
          )}

          {/* Desglose por persona */}
          <div>
            <p className="text-xs uppercase tracking-wider text-theme-muted mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Desglose por persona
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {summaries?.map((summary) => (
                <div
                  key={summary.userId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-theme-surface-muted transition-colors"
                >
                  <span className="text-sm text-theme-primary truncate flex-1">
                    {summary.userName}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-theme-muted">
                      {summary.totalHours}h
                    </span>
                    {summary.overtimeHours > 0 && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        +{summary.overtimeHours}h
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

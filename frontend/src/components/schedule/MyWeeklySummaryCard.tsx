import { useAuthStore } from '@/store/authStore';
import { useMyWeeklySummary } from '@/hooks/useMyWeeklySummary';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';
import { Clock, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * @description Tarjeta que muestra el resumen semanal de horas del usuario autenticado.
 * Visible para todos los roles, especialmente employee.
 */
export function MyWeeklySummaryCard() {
  const user = useAuthStore((s) => s.user);
  const now = new Date();
  const isoWeek = getISOWeek(now);
  const isoWeekYear = getISOWeekYear(now);

  const { data: summary, isLoading } = useMyWeeklySummary(isoWeekYear, isoWeek);

  if (!user) return null;

  return (
    <div className="card p-7">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-600" />
          Mi resumen semanal
        </h2>
        <span className="text-xs text-theme-muted">
          Semana {isoWeek} · {format(now, "MMMM yyyy", { locale: es })}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : !summary ? (
        <div className="text-center py-8">
          <Clock className="h-10 w-10 text-theme-muted mx-auto mb-2" />
          <p className="text-sm text-theme-muted">No hay datos de resumen semanal disponibles</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Métricas principales */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Horas totales</p>
              <p className="text-xl font-bold text-theme-primary mt-1">
                {Math.round(summary.totalHours * 10) / 10}h
              </p>
            </div>
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Base semanal</p>
              <p className="text-xl font-bold text-theme-primary mt-1">
                {Math.round(summary.baseHours * 10) / 10}h
              </p>
            </div>
            <div className="bg-theme-surface-muted rounded-xl p-3.5">
              <p className="text-xs text-theme-muted uppercase tracking-wider">Horas extra</p>
              <p className={`text-xl font-bold mt-1 ${summary.overtimeHours > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {Math.round(summary.overtimeHours * 10) / 10}h
              </p>
            </div>
          </div>

          {/* Alerta de horas extra */}
          {summary.overtimeHours > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                Has registrado <strong>{Math.round(summary.overtimeHours * 10) / 10}h</strong> de horas extra esta semana
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

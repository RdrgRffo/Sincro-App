import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, UserX, UserMinus, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlertItem {
  type: 'unassigned' | 'solo';
  scheduleId: string;
  title: string;
  date: string;
  assigneeName?: string;
}

interface AlertsModalProps {
  open: boolean;
  onClose: () => void;
  alerts: AlertItem[];
  lastMinuteCount: number;
}

export function AlertsModal({ open, onClose, alerts, lastMinuteCount }: AlertsModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const unassigned = alerts.filter((a) => a.type === 'unassigned');
  const solo = alerts.filter((a) => a.type === 'solo');

  const handleNavigateToSchedule = (scheduleId: string) => {
    onClose();
    navigate(`/schedule/${scheduleId}`, {
      state: { initialView: 'dayGridMonth', initialDate: new Date().toISOString() },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Alertas de turnos"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Alertas
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Sin personal */}
          {unassigned.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                <UserX className="h-4 w-4" />
                Turnos sin personal ({unassigned.length})
              </h3>
              <div className="space-y-2">
                {unassigned.map((alert) => (
                  <button
                    key={alert.scheduleId}
                    type="button"
                    onClick={() => handleNavigateToSchedule(alert.scheduleId)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {alert.title}
                      </p>
                      <p className="text-xs text-gray-600">
                        {format(parseISO(alert.date), "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Solitarios */}
          {solo.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                <UserMinus className="h-4 w-4" />
                Turnos con personal único ({solo.length})
              </h3>
              <div className="space-y-2">
                {solo.map((alert) => (
                  <button
                    key={alert.scheduleId}
                    type="button"
                    onClick={() => handleNavigateToSchedule(alert.scheduleId)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {alert.title}
                      </p>
                      <p className="text-xs text-gray-600">
                        {format(parseISO(alert.date), "EEEE d 'de' MMMM", { locale: es })} — {alert.assigneeName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Último minuto */}
          {lastMinuteCount > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Cambios de último minuto ({lastMinuteCount})
              </h3>
              <p className="text-sm text-gray-600 ml-6">
                Hay {lastMinuteCount} turno{lastMinuteCount !== 1 ? 's' : ''} creado{lastMinuteCount !== 1 ? 's' : ''} de último minuto esta semana.
              </p>
            </div>
          )}

          {/* Sin alertas */}
          {alerts.length === 0 && lastMinuteCount === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No hay alertas activas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

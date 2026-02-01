import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, X, Clock, CalendarCheck, CalendarX, UserMinus, UserPlus, ShieldAlert, RefreshCw, Trash2 } from 'lucide-react';
import type { InAppNotification } from '@/hooks/useInAppNotifications';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  absence_request_sent: <CalendarCheck className="h-4 w-4 text-gray-600" />,
  absence_approved: <CalendarCheck className="h-4 w-4 text-gray-700" />,
  absence_rejected: <CalendarX className="h-4 w-4 text-gray-500" />,
  absence_cancelled: <CalendarX className="h-4 w-4 text-gray-500" />,
  absence_requested: <CalendarCheck className="h-4 w-4 text-gray-600" />,
  schedule_assigned: <UserPlus className="h-4 w-4 text-gray-600" />,
  schedule_modified: <Clock className="h-4 w-4 text-gray-500" />,
  schedule_deleted: <UserMinus className="h-4 w-4 text-gray-500" />,
  schedule_removed: <UserMinus className="h-4 w-4 text-gray-500" />,
  profile_updated: <ShieldAlert className="h-4 w-4 text-gray-600" />,
  password_changed: <ShieldAlert className="h-4 w-4 text-gray-600" />,
  system: <Bell className="h-4 w-4 text-gray-500" />,
};

function getTypeIcon(type: string): React.ReactNode {
  return TYPE_ICONS[type] ?? <Bell className="h-4 w-4 text-gray-400" />;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

interface NotificationPanelProps {
  unreadCount: number;
  notifications: InAppNotification[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onRefresh: () => void;
  onFetchMore: (page: number) => void;
  pagination: { page: number; total: number; totalPages: number };
}

export function NotificationPanel({
  unreadCount,
  notifications,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  onRefresh,
  onFetchMore,
  pagination,
}: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón de campana */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-theme-muted relative"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-gray-700 rounded-full min-w-[18px] min-h-[18px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Leer todas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onDeleteAll}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  title="Eliminar todas"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar todo
                </button>
              )}
              <button
                type="button"
                onClick={onRefresh}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
                aria-label="Actualizar notificaciones"
                title="Actualizar"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Bell className="h-8 w-8 mb-2" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`w-full px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !notif.readAt ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {getTypeIcon(notif.type)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!notif.readAt) onMarkAsRead(notif.id);
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatTimeAgo(notif.createdAt)}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(notif.id)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        aria-label="Eliminar notificación"
                        title="Eliminar notificación"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {!notif.readAt && (
                        <div className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))}

                {/* Paginación */}
                {pagination.totalPages > 1 && pagination.page < pagination.totalPages && (
                  <button
                    type="button"
                    onClick={() => onFetchMore(pagination.page + 1)}
                    disabled={loading}
                    className="w-full py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loading ? 'Cargando...' : 'Ver más'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer con total */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
              {pagination.total} notificaciones en total
            </div>
          )}
        </div>
      )}
    </div>
  );
}

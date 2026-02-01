import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS } from '@/types';
import { NotificationPanel } from '@/components/common/NotificationPanel';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';

export function TopBar({ title }: { title?: string }) {

  const user = useAuthStore((s) => s.user);
  const {
    unreadCount,
    notifications,
    loading,
    pagination,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refreshNotifications,
  } = useInAppNotifications();

  return (
    <header
      className="border-b border-gray-200 px-5 md:px-8 h-16 flex items-center justify-end gap-4 sticky top-0 z-20 shadow-sm"
      style={{
        backgroundColor: 'var(--theme-topbar-bg)',
        color: 'var(--theme-topbar-text)',
      }}
    >
      <div className="flex items-center gap-2">
        {title ? (
          <div className="pr-4 hidden md:block">
            <h2 className="text-lg font-semibold text-theme-primary">{title}</h2>
          </div>
        ) : null}

        <NotificationPanel
          unreadCount={unreadCount}
          notifications={notifications}
          loading={loading}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onDeleteAll={deleteAllNotifications}
          onRefresh={refreshNotifications}
          onFetchMore={(page) => fetchNotifications(page)}
          pagination={pagination}
        />
        <Link to="/profile" className="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-tight text-theme-primary">{user?.name}</p>
            <p className="text-xs opacity-75 text-theme-muted">{user?.role?.name ? ROLE_LABELS[user.role.name] : ''}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

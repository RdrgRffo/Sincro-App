import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import { getRealtimeSocket, REALTIME_EVENTS } from '@/realtime/socketClient';

export interface InAppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Cuerpo estándar de listados paginados del backend (`sendPaginated`) */
interface NotificationsListBody {
  success?: boolean;
  data?: InAppNotification[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function useInAppNotifications() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageRef = useRef(1);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/in-app-notifications/unread-count');
      setUnreadCount(res.data.data?.count ?? 0);
    } catch {
      // Silently fail
    }
  }, []);

  const fetchNotifications = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await api.get('/in-app-notifications', {
        params: { page, pageSize },
      });
      const body = res.data as NotificationsListBody;
      const items = body.data ?? [];
      const p = body.pagination;
      setNotifications(items);
      setPagination({
        page: p?.page ?? 1,
        total: p?.total ?? 0,
        totalPages: p?.totalPages ?? 0,
      });
      pageRef.current = p?.page ?? 1;
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/in-app-notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/in-app-notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.delete(`/in-app-notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await fetchUnreadCount();
    } catch {
      // Silently fail
    }
  }, [fetchUnreadCount]);

  const deleteAllNotifications = useCallback(async () => {
    try {
      await api.delete('/in-app-notifications');
      setNotifications([]);
      setUnreadCount(0);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } catch {
      // Silently fail
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    await Promise.all([fetchUnreadCount(), fetchNotifications(pageRef.current)]);
  }, [fetchNotifications, fetchUnreadCount]);

  // Polling cada 30 segundos para el contador de no leídas
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUnreadCount();
    }, 0);
    pollingRef.current = setInterval(fetchUnreadCount, 30_000);
    return () => {
      clearTimeout(timer);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchUnreadCount]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket || !userId) return;

    const handler = (payload: { meta?: { userId?: string } }) => {
      if (payload.meta?.userId !== userId) return;
      void fetchUnreadCount();
      void fetchNotifications(pageRef.current);
    };

    socket.on(REALTIME_EVENTS.NOTIFICATION_CHANGED, handler);
    return () => {
      socket.off(REALTIME_EVENTS.NOTIFICATION_CHANGED, handler);
    };
  }, [fetchNotifications, fetchUnreadCount, userId]);

  return {
    unreadCount,
    notifications,
    loading,
    pagination,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refreshNotifications,
  };
}

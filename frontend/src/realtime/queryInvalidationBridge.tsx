import { useEffect } from 'react';
import { queryClient } from '@/config/queryClient';
import { useAuthStore } from '@/store/authStore';
import {
  connectRealtime,
  disconnectRealtime,
  getRealtimeSocket,
  REALTIME_EVENTS,
  type RealtimeEventName,
} from './socketClient';

type RealtimePayload = {
  entity: 'schedule' | 'user' | 'audit';
  action: string;
  id: string;
  changedAt: string;
  actorId: string | null;
  meta?: Record<string, unknown>;
};

function invalidateForAudit() {
  queryClient.invalidateQueries({ queryKey: ['audit'] });
  queryClient.invalidateQueries({ queryKey: ['audit-detail'] });
}

function invalidateForSchedules() {
  queryClient.invalidateQueries({ queryKey: ['schedules'] });
  queryClient.invalidateQueries({ queryKey: ['schedule-detail'] });
  queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
  queryClient.invalidateQueries({ queryKey: ['audit'] });
}

function invalidateForUsers() {
  queryClient.invalidateQueries({ queryKey: ['users'] });
  queryClient.invalidateQueries({ queryKey: ['users', 'count'] });
  queryClient.invalidateQueries({ queryKey: ['user-detail'] });
  queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
  queryClient.invalidateQueries({ queryKey: ['audit'] });
}

function registerEvent(eventName: RealtimeEventName) {
  const socket = getRealtimeSocket();
  if (!socket) return () => {};

  const handler = (payload: RealtimePayload) => {
    if (payload.entity === 'schedule') {
      invalidateForSchedules();
      return;
    }
    if (payload.entity === 'user') {
      invalidateForUsers();
      return;
    }
    if (payload.entity === 'audit') {
      invalidateForAudit();
    }
  };

  socket.on(eventName, handler);
  return () => socket.off(eventName, handler);
}

export function QueryInvalidationBridge() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectRealtime();
      return;
    }

    connectRealtime();

    const unsubs = [
      registerEvent(REALTIME_EVENTS.SCHEDULE_CREATED),
      registerEvent(REALTIME_EVENTS.SCHEDULE_UPDATED),
      registerEvent(REALTIME_EVENTS.SCHEDULE_DELETED),
      registerEvent(REALTIME_EVENTS.USER_CREATED),
      registerEvent(REALTIME_EVENTS.USER_UPDATED),
      registerEvent(REALTIME_EVENTS.USER_STATUS_CHANGED),
      registerEvent(REALTIME_EVENTS.USER_ROLE_CHANGED),
      registerEvent(REALTIME_EVENTS.USER_DELETED),
      registerEvent(REALTIME_EVENTS.AUDIT_CREATED),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [isAuthenticated, accessToken]);

  return null;
}

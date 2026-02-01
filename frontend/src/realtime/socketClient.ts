import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

export const REALTIME_EVENTS = {
  SCHEDULE_CREATED: 'schedule.created',
  SCHEDULE_UPDATED: 'schedule.updated',
  SCHEDULE_DELETED: 'schedule.deleted',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_STATUS_CHANGED: 'user.statusChanged',
  USER_ROLE_CHANGED: 'user.roleChanged',
  USER_DELETED: 'user.deleted',
  AUDIT_CREATED: 'audit.created',
  NOTIFICATION_CHANGED: 'notification.changed',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

let socket: Socket | null = null;

function getToken() {
  return useAuthStore.getState().accessToken;
}

function createSocketInstance(token: string) {
  const instance = io(import.meta.env.VITE_API_URL || '/', {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: false,
    auth: { token },
  });

  instance.on('connect', () => {
    console.log('[Realtime] Connected successfully');
  });

  instance.on('connect_error', (err) => {
    console.error('[Realtime] Connection error:', err.message);
    if (err.message === 'AUTH_INVALID_TOKEN' || err.message === 'AUTH_MISSING_TOKEN') {
      console.warn('[Realtime] Authentication failed, please check if your session is valid');
    }
  });

  instance.on('disconnect', (reason) => {
    console.log('[Realtime] Disconnected:', reason);
  });

  return instance;
}

export function connectRealtime() {
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = createSocketInstance(token);
  } else {
    // If token changed, we must update it and reconnect
    const currentToken = (socket.auth as { token?: string })?.token;
    if (currentToken !== token) {
      console.log('[Realtime] Token changed, reconnecting...');
      socket.auth = { token };
      if (socket.connected) {
        socket.disconnect().connect();
      } else {
        socket.connect();
      }
    }
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function reconnectRealtimeWithFreshToken() {
  if (!socket) return;
  const token = getToken();
  if (!token) {
    socket.disconnect();
    return;
  }

  console.log('[Realtime] Manual reconnection requested with fresh token');
  socket.auth = { token };
  if (socket.connected) socket.disconnect();
  socket.connect();
}

export function disconnectRealtime() {
  if (!socket) return;
  socket.disconnect();
}

export function getRealtimeSocket() {
  return socket;
}

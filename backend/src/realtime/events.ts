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

export interface RealtimeEventPayload {
  entity: 'schedule' | 'user' | 'audit' | 'notification';
  action: 'created' | 'updated' | 'deleted' | 'statusChanged' | 'roleChanged';
  id: string;
  changedAt: string;
  actorId: string | null;
  meta?: Record<string, unknown>;
}

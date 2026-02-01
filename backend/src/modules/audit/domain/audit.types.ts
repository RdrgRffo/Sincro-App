/**
 * Estructura para los detalles de una auditoría que soporta Rollback.
 */
export interface AuditDetails {
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Acciones que NO se pueden revertir por seguridad o lógica de negocio.
 */
export const IRREVERSIBLE_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'CHANGE_PASSWORD',
  'RESET_PASSWORD',
  'FAILED_LOGIN_ATTEMPT',
  'ROLLBACK_PERFORMED', // Un rollback no se revierte con otro rollback simple para evitar bucles
] as const;

export type IrreversibleAction = typeof IRREVERSIBLE_ACTIONS[number];

/**
 * Parámetros para crear un log de auditoría.
 */
export interface AuditParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  detailsJson?: AuditDetails | object;
  ipAddress?: string;
  userAgent?: string;
}

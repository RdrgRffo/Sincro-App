export const ROLES = {
  ADMIN: 'admin',
  GENERAL_MANAGER: 'general_manager',
  DEPARTMENT_MANAGER: 'department_manager',
  EMPLOYEE: 'employee',
} as const;

export const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  LOCKED: 'locked',
} as const;

export const NOTIFICATION_TYPES = {
  SCHEDULE_CREATED: 'schedule_created',
  SCHEDULE_MODIFIED: 'schedule_modified',
  SCHEDULE_DELETED: 'schedule_deleted',
  SCHEDULE_LASTMINUTE: 'schedule_lastminute',
  FRIDAY_REMINDER: 'friday_reminder',
  MANUAL_ANNOUNCEMENT: 'manual_announcement',
  TEST: 'test',
} as const;

export const NOTIFICATION_STATUS = {
  SENT: 'sent',
  FAILED: 'failed',
  PENDING: 'pending',
} as const;

export const DEPARTMENT_CATALOG = [
  { key: 'seguridad', name: 'Seguridad', code: 'SEG' },
  { key: 'mantenimiento', name: 'Mantenimiento', code: 'MANT' },
  { key: 'operaciones', name: 'Operaciones', code: 'OPER' },
  { key: 'administracion', name: 'Administración', code: 'ADMIN' },
  { key: 'sistemas', name: 'Sistemas', code: 'SIST' },
  { key: 'rrhh', name: 'Recursos Humanos', code: 'RRHH' },
  { key: 'calidad', name: 'Calidad', code: 'CAL' },
  { key: 'logistica', name: 'Logística', code: 'LOG' },
] as const;

/** Intentos fallidos de login (sin acierto) antes del primer bloqueo temporal */
export const LOGIN_LOCKOUT_FIRST_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_FIRST_MINUTES = 5;

/** Segundo umbral: bloqueo más largo */
export const LOGIN_LOCKOUT_SECOND_ATTEMPTS = 10;
export const LOGIN_LOCKOUT_SECOND_MINUTES = 30;

/** Tercer umbral: cuenta deshabilitada (requiere administrador) */
export const LOGIN_LOCKOUT_DISABLE_ATTEMPTS = 15;

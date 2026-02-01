export interface User {
  id: string;
  employeeId?: string | null;
  name: string;
  email: string;
  role: {
    name: string;
    permissions?: Array<{ name: string }>;
  };
  roleId?: string | null;
  permissions?: string[]; // Flattened permissions array for easier consumption

  status: 'active' | 'disabled' | 'locked';
  avatarUrl?: string;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  managedDepartments?: Array<{
    departmentId: string;
    assignedAt: string;
    id: string;
    name: string;
    code: string;
  }> | null;
  createdAt: string;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  failedAttempts?: number;
  forcePasswordChange?: boolean;
  passwordChangePolicy?: 'none' | 'warning' | 'required';
  passwordChangeState?: 'none' | 'warning' | 'required';
  passwordChangeWarnedAt?: string | null;
  passwordChangeDeadlineAt?: string | null;
  companyPhone?: string;
  auxiliaryPhone?: string;
  branchId?: string | null;
  branch?: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  } | null;
  visibleBranches?: Array<{
    branch: {
      id: string;
      name: string;
      code: string;
      isActive: boolean;
    };
    assignedAt: string;
  }>;
  skills?: Array<{
    level?: string | null;
    expiresAt?: string | null;
    notes?: string | null;
    assignedAt: string;
    skill: Skill;
  }>;
}

export interface Skill {
  id: string;
  name: string;
  category?: string | null;
  color: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Array<{ name: string }>;
}

export interface ScheduleType {
  id: string;
  value: string;
  label: string;
  color: string;
}


export interface Schedule {
  id: string;
  title: string;
  description?: string;
  startDatetime: string;
  endDatetime: string;
  type: string;
  scheduleTypeId: string;
  color: string;
  location?: string;
  notes?: string;
  isLastMinute: boolean;
  hoursPerDay?: number;
  branchId?: string;
  branch?: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  };
  departmentId?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  assignments: ScheduleAssignment[];
}

export interface ScheduleAssignment {
  scheduleId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    department?: {
      id: string;
      name: string;
      code: string;
      branchId?: string;
    } | null;
    companyPhone?: string;
    auxiliaryPhone?: string;
  };
  assignedAt: string;
}

export interface WeekScheduleAssignee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  department?: {
    id: string;
    name: string;
    code: string;
    branchId?: string;
  } | null;
  companyPhone?: string;
  auxiliaryPhone?: string;
}

export interface WeekScheduleItem {
  id: string;
  title: string;
  startDatetime: string;
  endDatetime: string;
  type: string;
  scheduleTypeId: string;
  color: string;
  location?: string | null;
  notes?: string | null;
  isLastMinute: boolean;
  hoursPerDay?: number;
  branchId?: string | null;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  assignees: WeekScheduleAssignee[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  managerId?: string | null;
  manager?: User | null;
}
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branchId?: string;
  branches?: Array<{
    branch: {
      id: string;
      name: string;
      code: string;
      isActive: boolean;
    };
    createdAt?: string;
  }>;
    managers?: Array<{
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string | null;
        roleId?: string | null;
        role?: { name: string } | null;
      };
      assignedAt: string;
    }>;
  _count?: {
    users: number;
  };
}

export interface BranchHoliday {
  id: string;
  branchId: string;
  date: string;
  originalDate?: string | null;
  name: string;
  type: 'nacional' | 'autonomica' | 'local' | 'mejora' | 'regional' | 'company';
  scope: 'national' | 'regional' | 'local' | 'company';
  isPartial: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface GroupedBranchHoliday {
  id: string;
  branchId: 'all';
  date: string;
  originalDate?: string | null;
  name: string;
  type: BranchHoliday['type'];
  scope: BranchHoliday['scope'];
  isPartial: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch: null;
  holidayIds: string[];
  branches: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  sharedCount: number;
}

export type CalendarBranchHoliday = BranchHoliday | GroupedBranchHoliday;

export interface WeekSchedulesResponse {
  year: number;
  week: number;
  weekStart: string;
  weekEnd: string;
  total: number;
  items: WeekScheduleItem[];
}

export interface WebhookConfig {
  id: string;
  name: string;
  webhookUrl: string;
  enabled: boolean;
  notifyModifications: boolean;
  notifyLastMinute: boolean;
  fridayReminderEnabled: boolean;
  mondayAbsenceReminderEnabled: boolean;
  fridayReminderTime: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  type: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: string;
  errorMessage?: string;
  scheduleId?: string;
  webhookConfig?: { id: string; name: string } | null;
  sentBy?: { id: string; name: string } | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  detailsJson?: unknown;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
  rolledBackAt?: string | null;
  rolledBackBy?: { id: string; name: string } | null;
  user?: { id: string; name: string; email: string; department?: { id: string; name: string; code: string } | null } | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error?: string;
  code?: string;
  errors?: unknown;
}

export type ThemeLogoVariant = 'logo_claro' | 'logo_oscuro';

// Schedule types are now fetched from API - see useScheduleTypes hook

export type ScheduleTypeValue = 'guardia' | 'ausencia' | 'vacaciones' | 'formacion' | 'otro' | 'excepcion';

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  general_manager: 'Gerente General',
  department_manager: 'Responsable',
  employee: 'Empleado',
};


export const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  disabled: 'Deshabilitado',
  locked: 'Bloqueado',
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  schedule_created: 'Guardia Creada',
  schedule_modified: 'Guardia Modificada',
  schedule_deleted: 'Guardia Eliminada',
  schedule_assigned: 'Turno asignado',
  schedule_removed: 'Quitado del turno',
  schedule_lastminute: 'Último Momento',
  friday_reminder: 'Resumen Viernes',
  manual_announcement: 'Anuncio Manual',
  monday_absence_summary: 'Ausencias (resumen semana)',
  absence_request_sent: 'Solicitud de ausencia enviada',
  absence_requested: 'Nueva solicitud de ausencia',
  absence_approved: 'Ausencia aprobada',
  absence_rejected: 'Ausencia rechazada',
  absence_cancelled: 'Ausencia cancelada',
  profile_updated: 'Perfil actualizado',
  password_changed: 'Contraseña actualizada',
  system: 'Aviso del sistema',
  test: 'Prueba',
};

/** Etiqueta legible para tipos de log de notificación (eventos `absence_*`, `schedule_*`, etc.). */
export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

// ── Absence types (API /api/absences) ───────────────────────────
export type AbsenceStatus = 'pending' | 'colindante' | 'approved' | 'rejected' | 'cancelled';

/** Valores de `Absence.type` en Prisma (motivo de la ausencia). */
export type AbsenceKind =
  | 'vacaciones'
  | 'asuntos_propios'
  | 'formacion'
  | 'permiso_retribuido'
  | 'cumpleanos'
  | 'baja_medica'
  | 'maternidad'
  | 'paternidad'
  | 'compensatorio'
  | 'festivo';

export interface AbsenceRequest {
  id: string;
  employeeId: string;
  type?: AbsenceKind;
  status: AbsenceStatus;
  startDate: string;
  endDate: string;
  note?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  branchId: string;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    employeeId?: string | null;
    department: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
  };
  reviewer?: { id: string; name: string; email: string } | null;
  branch: { id: string; name: string; code: string };
  department: { id: string; name: string; code: string };
}

export interface AbsenceCalendarItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeAvatarUrl?: string | null;
  employeeDepartment: { id: string; name: string } | null;
  employeeBranch: { id: string; name: string } | null;
  startDate: string;
  endDate: string;
  note?: string | null;
  branchId: string;
  departmentId: string;
}

export interface PaginatedAbsences {
  items: AbsenceRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AbsenceCalendarResponse {
  year: number;
  week: number;
  weekStart: string;
  weekEnd: string;
  total: number;
  items: AbsenceCalendarItem[];
}

// Security Constants (Sync with backend/src/config/constants.ts)
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

// ── Shared sort types ──────────────────────────────────────────────
export type UsersSortBy = 'createdAt' | 'name' | 'email' | 'roleId' | 'status' | 'lastLoginAt' | 'department' | 'branchId';
export type AuditSortBy = 'createdAt' | 'action' | 'entityType' | 'userName' | 'userDepartment';
export type SortOrder = 'asc' | 'desc';

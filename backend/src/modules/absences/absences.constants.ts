export const ABSENCE_PERMISSIONS = {
  CREATE: 'absences:create',
  READ: 'absences:read',
  READ_ALL: 'absences:read-all',
  APPROVE: 'absences:approve',
  CANCEL: 'absences:cancel',
  DELETE: 'absences:delete',
} as const;

export const ABSENCE_STATUS = {
  PENDING: 'pending',
  COLINDANTE: 'colindante',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export type AbsenceStatus = (typeof ABSENCE_STATUS)[keyof typeof ABSENCE_STATUS];

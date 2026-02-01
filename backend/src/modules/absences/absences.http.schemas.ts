import { z } from 'zod';
import { $Enums } from '@prisma/client';
const AbsenceType = $Enums.AbsenceType;

// Validar que una fecha sea día laborable (lunes a viernes)
const isWeekday = (date: Date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

export const createAbsenceRequestSchema = z
  .object({
    startDate: z.coerce.date().refine((date) => isWeekday(date), {
      message: 'La fecha de inicio debe ser un día laborable (lunes a viernes)',
    }),
    endDate: z.coerce.date().refine((date) => isWeekday(date), {
      message: 'La fecha de fin debe ser un día laborable (lunes a viernes)',
    }),
    type: z.nativeEnum(AbsenceType),
    note: z.string().max(500).optional(),
    /** Si se omite, la solicitud es para el propio actor (empleado o gestor). Solo admin / GM / DM pueden indicar otro empleado acotado a su alcance. */
    employeeId: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      return data.endDate >= data.startDate;
    },
    {
      message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
      path: ['endDate'],
    }
  );

export const approveAbsenceSchema = z.object({
  note: z.string().max(500).optional(),
});

export const rejectAbsenceSchema = z.object({
  rejectionReason: z.string().min(1, 'El motivo de rechazo es obligatorio').max(500),
});

export const absenceIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listAbsencesQuerySchema = z.object({
  status: z.string().optional(),
  employeeId: z.string().optional(),
  search: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const absenceCalendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  week: z.coerce.number().int().min(1).max(53).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
});

export type CreateAbsenceRequestInput = z.infer<typeof createAbsenceRequestSchema>;
export type ApproveAbsenceInput = z.infer<typeof approveAbsenceSchema>;
export type RejectAbsenceInput = z.infer<typeof rejectAbsenceSchema>;
export type ListAbsencesQuery = z.infer<typeof listAbsencesQuerySchema>;
export type AbsenceCalendarQuery = z.infer<typeof absenceCalendarQuerySchema>;

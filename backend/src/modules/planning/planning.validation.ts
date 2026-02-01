import { z } from 'zod';

const planningIdSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).max(100).optional(),
);

const dateQuerySchema = z
  .string({ error: 'Fecha requerida' })
  .trim()
  .min(1, 'Fecha requerida')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Fecha invalida')
  .transform((value) => new Date(value));

const planningRangeQueryBaseSchema = z.object({
  from: dateQuerySchema,
  to: dateQuerySchema,
  branchId: planningIdSchema,
  departmentId: planningIdSchema,
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const planningRangeQuerySchema = planningRangeQueryBaseSchema
  .refine((value) => value.from <= value.to, {
    message: 'La fecha de inicio no puede ser posterior a la fecha de fin',
    path: ['from'],
  });

const commaSeparatedIdsSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return [];
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  },
  z.array(z.string().min(1)).default([]),
);

export const planningSubstitutesQuerySchema = planningRangeQueryBaseSchema.extend({
  scheduleId: planningIdSchema,
  skillIds: commaSeparatedIdsSchema,
}).refine((value) => value.from <= value.to, {
  message: 'La fecha de inicio no puede ser posterior a la fecha de fin',
  path: ['from'],
});

export const planningTemplatePreviewQuerySchema = planningRangeQueryBaseSchema.extend({
  scheduleId: planningIdSchema,
  skillIds: commaSeparatedIdsSchema,
  minCoverage: z.coerce.number().int().min(1).max(10).optional().default(1),
}).refine((value) => value.from <= value.to, {
  message: 'La fecha de inicio no puede ser posterior a la fecha de fin',
  path: ['from'],
});

export const absenceImpactQuerySchema = z.object({
  employeeId: planningIdSchema,
  startDate: dateQuerySchema,
  endDate: dateQuerySchema,
}).refine((value) => value.startDate <= value.endDate, {
  message: 'La fecha de inicio no puede ser posterior a la fecha de fin',
  path: ['startDate'],
});

export const planningCommentsQuerySchema = z.object({
  entityType: z.string().trim().min(2).max(80),
  entityId: z.string().trim().min(1).max(100),
});

export const planningCommentBodySchema = planningCommentsQuerySchema.extend({
  body: z.string().trim().min(1).max(2000),
});

export const notificationPreferencesBodySchema = z.object({
  scheduleChanges: z.boolean().optional(),
  absenceUpdates: z.boolean().optional(),
  departmentAbsenceRequests: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  criticalAlertsOnly: z.boolean().optional(),
});

export type PlanningRangeQueryInput = z.infer<typeof planningRangeQuerySchema>;
export type PlanningSubstitutesQueryInput = z.infer<typeof planningSubstitutesQuerySchema>;
export type PlanningTemplatePreviewQueryInput = z.infer<typeof planningTemplatePreviewQuerySchema>;
export type AbsenceImpactQueryInput = z.infer<typeof absenceImpactQuerySchema>;
export type PlanningCommentsQueryInput = z.infer<typeof planningCommentsQuerySchema>;
export type PlanningCommentInput = z.infer<typeof planningCommentBodySchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesBodySchema>;

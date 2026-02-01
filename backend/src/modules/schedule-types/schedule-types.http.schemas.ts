import { z } from 'zod';

export const createScheduleTypeSchema = z.object({
  value: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be #RRGGBB)'),
});

export const updateScheduleTypeSchema = z.object({
  value: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be #RRGGBB)').optional(),
  isActive: z.boolean().optional(),
});

export type CreateScheduleTypeInput = z.infer<typeof createScheduleTypeSchema>;
export type UpdateScheduleTypeInput = z.infer<typeof updateScheduleTypeSchema>;
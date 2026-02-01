import { z } from 'zod';
import { stripHtml } from '../../utils/sanitize';

export const createShiftPresetSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100).transform(stripHtml),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  isActive: z.boolean().optional().default(true),
});

export const updateShiftPresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido').optional(),
  isActive: z.boolean().optional(),
});

export const applyShiftPresetSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  branchId: z.string().min(1, 'La sucursal es obligatoria'),
  scheduleTypeId: z.string().min(1, 'El tipo de turno es obligatorio'),
  assigneeIds: z.array(z.string()).min(1, 'Al menos una persona debe estar asignada'),
  title: z.string().min(2).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  hoursPerDay: z.number().min(0.5).max(24).optional().default(8),
  excludeWeekends: z.boolean().optional().default(true),
  reason: z.string().optional(),
});

export const previewShiftPresetSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  excludeWeekends: z.boolean().optional().default(true),
});

export type CreateShiftPresetInput = z.infer<typeof createShiftPresetSchema>;
export type UpdateShiftPresetInput = z.infer<typeof updateShiftPresetSchema>;
export type ApplyShiftPresetInput = z.infer<typeof applyShiftPresetSchema>;
export type PreviewShiftPresetInput = z.infer<typeof previewShiftPresetSchema>;

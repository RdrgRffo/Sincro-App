import { z } from 'zod';
import { stripHtml, stripHtmlOptional } from '../../utils/sanitize';

export const scheduleIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const weekParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  week: z.coerce.number().int().min(1).max(53),
});

export const listSchedulesQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  userId: z.string().optional(),
  type: z.string().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
});


export const listWeekSchedulesQuerySchema = z.object({
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
});

// Define un esquema base para el cuerpo de la guardia
const baseScheduleBodySchema = z.object({
  title: z.string().min(2).transform(stripHtml),
  description: z.string().optional().transform(stripHtmlOptional),
  startDatetime: z.coerce.date(),
  endDatetime: z.coerce.date(),
  scheduleTypeId: z.string().min(1, 'El ID del tipo de turno es obligatorio'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be #RRGGBB)').optional(),
  location: z.string().optional().transform(stripHtmlOptional),
  notes: z.string().optional().transform(stripHtmlOptional),
  branchId: z.string().min(1, 'La sucursal es obligatoria'),
  departmentId: z.string().optional(),
  assigneeIds: z.array(z.string()).min(1, 'Al menos una persona debe estar asignada'),
  hoursPerDay: z.number().min(0.5).max(24).optional().default(8),
  confirmed: z.boolean().optional().default(false),
});

// Función de preprocesamiento para extraer IDs de objetos
const extractIdsPreprocess = (data: any) => {
  if (data && typeof data === 'object') {
    if (!data.scheduleTypeId && data.scheduleType?.id) data.scheduleTypeId = data.scheduleType.id;
    if (!data.scheduleTypeId && data.type?.id) data.scheduleTypeId = data.type.id;
    if (!data.branchId && data.branch?.id) data.branchId = data.branch.id;
  }
  return data;
};

export const createScheduleBodySchema = z.preprocess(extractIdsPreprocess, baseScheduleBodySchema);

export const createScheduleBulkBodySchema = z.preprocess(
  (data: any) => {
    if (data && Array.isArray(data.items)) {
      return {
        ...data,
        items: data.items.map((item: any) => extractIdsPreprocess(item)),
      };
    }
    return data;
  },
  z.object({
    items: z.array(baseScheduleBodySchema).min(1, 'Debe incluir al menos un turno'),
  }),
);

export const updateScheduleBodySchema = z.preprocess(
  extractIdsPreprocess,
  baseScheduleBodySchema.partial().extend({
    reason: z.string().optional(),
  })
);

export const deleteScheduleBodySchema = z.object({
  reason: z.string().optional(),
});

// ── Weekly Summary ──────────────────────────────────────────

export const weeklySummaryParamsSchema = z.object({
  userId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  week: z.coerce.number().int().min(1).max(53),
});

export const weeklySummaryQuerySchema = z.object({
  fromWeek: z.coerce.number().int().min(1).max(53).optional(),
  toWeek: z.coerce.number().int().min(1).max(53).optional(),
});

export const teamWeeklySummaryParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  week: z.coerce.number().int().min(1).max(53),
});

export const teamWeeklySummaryQuerySchema = z.object({
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

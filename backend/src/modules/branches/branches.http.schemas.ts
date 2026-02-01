import { z } from 'zod';
import { stripHtml, stripHtmlOptional } from '../../utils/sanitize';
import { HOLIDAY_TYPES, HOLIDAY_SCOPES } from './branches.constants';

const branchCodeRegex = /^[A-Z0-9_-]{2,20}$/;

export const branchIdParamsSchema = z.object({
  branchId: z.string().min(1),
});

export const holidayIdParamsSchema = z.object({
  branchId: z.string().min(1),
  holidayId: z.string().min(1),
});

export const listBranchesQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export const createBranchBodySchema = z.object({
  name: z.string().min(2).max(80).transform(stripHtml),
  code: z.string().trim().toUpperCase().regex(branchCodeRegex, 'Código inválido (2-20, A-Z, 0-9, _ o -)'),
  address: z.string().max(160).optional().transform(stripHtmlOptional),
  city: z.string().max(80).optional().transform(stripHtmlOptional),
  region: z.string().max(80).optional().transform(stripHtmlOptional),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  timezone: z.string().min(3).max(50).optional(),
});

export const updateBranchBodySchema = createBranchBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listBranchHolidaysQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
  groupShared: z.coerce.boolean().optional().default(false),
});

const holidayTypeSchema = z.enum(HOLIDAY_TYPES);
const holidayScopeSchema = z.enum(HOLIDAY_SCOPES);

export const createBranchHolidayBodySchema = z.object({
  date: z.coerce.date(),
  originalDate: z.coerce.date().optional().nullable(),
  name: z.string().min(2).max(120).transform(stripHtml),
  type: holidayTypeSchema,
  scope: holidayScopeSchema.optional(),
  isPartial: z.boolean().optional().default(false),
});

export const updateBranchHolidayBodySchema = createBranchHolidayBodySchema.partial();

const bulkHolidayIdsSchema = z.array(z.string().min(1)).min(1, 'Debes indicar al menos un festivo');

export const bulkUpdateBranchHolidayBodySchema = z.object({
  holidayIds: bulkHolidayIdsSchema,
  name: z.string().min(2).max(120).optional().transform(stripHtmlOptional),
  date: z.coerce.date().optional(),
  type: holidayTypeSchema.optional(),
  scope: holidayScopeSchema.optional(),
  isPartial: z.boolean().optional(),
}).refine(
  (data) => data.name !== undefined
    || data.date !== undefined
    || data.type !== undefined
    || data.scope !== undefined
    || data.isPartial !== undefined,
  { message: 'Debes indicar al menos un campo para actualizar' },
);

export const bulkDeleteBranchHolidayBodySchema = z.object({
  holidayIds: bulkHolidayIdsSchema,
});

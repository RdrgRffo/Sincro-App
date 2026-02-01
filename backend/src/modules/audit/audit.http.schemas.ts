import { z } from 'zod';

export const auditSortBySchema = z.enum(['createdAt', 'action', 'entityType', 'userName', 'userDepartment']);
export const sortOrderSchema = z.enum(['asc', 'desc']);

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  userId: z.string().optional(),
  userName: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  // 'true' = solo acciones revertibles, 'false' = solo acciones irreversibles (seguridad/sesión)
  reversible: z.enum(['true', 'false']).optional(),
  userDepartment: z.string().optional(),
  branchId: z.string().optional(),
  sortBy: auditSortBySchema.optional().default('createdAt'),
  sortOrder: sortOrderSchema.optional().default('desc'),
});

export const auditIdParamsSchema = z.object({
  id: z.string().min(1),
});

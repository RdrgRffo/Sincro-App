import { z } from 'zod';

export const skillIdParamsSchema = z.object({
  id: z.string().trim().min(1, 'Skill requerida'),
});

export const userSkillParamsSchema = z.object({
  userId: z.string().trim().min(1, 'Usuario requerido'),
});

export const listSkillsQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

export const createSkillBodySchema = z.object({
  name: z.string().trim().min(2, 'Nombre requerido').max(100, 'Nombre muy largo'),
  category: z.string().trim().max(100).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const updateSkillBodySchema = createSkillBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const assignUserSkillsBodySchema = z.object({
  skillIds: z.array(z.string().trim().min(1)).default([]),
});

export type CreateSkillInput = z.infer<typeof createSkillBodySchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillBodySchema>;
export type ListSkillsQuery = z.infer<typeof listSkillsQuerySchema>;

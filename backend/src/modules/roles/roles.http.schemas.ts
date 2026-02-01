import { z } from 'zod';
import { stripHtml } from '../../utils/sanitize';
import { PERMISSIONS } from './roles.constants';

export const RolePermissionSchema = z.enum(PERMISSIONS);

export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(50).transform(stripHtml),
  description: z.string().optional().nullable().transform((v) => v ? stripHtml(v) : v),
  permissions: z.array(RolePermissionSchema).optional(),
});

export const UpdateRoleSchema = CreateRoleSchema.partial();

import { z } from 'zod';
import { stripHtml, stripHtmlOptional } from '../../utils/sanitize';
import { USER_STATUSES } from './users.constants';
import { ROLE_NAMES } from '../roles/roles.constants';

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(500).optional().default(20),
  search: z.string().optional(),
  email: z.string().email().optional(),
  roleId: z.string().optional(),
  role: z.enum(ROLE_NAMES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  branchId: z.string().optional(),
  lastLoginFrom: z.string().optional(),
  lastLoginTo: z.string().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'email', 'roleId', 'status', 'lastLoginAt', 'department', 'branchId', 'branch']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createUserBodySchema = z.object({
  employeeId: z.string().optional().nullable(),
  name: z.string().min(2).transform(stripHtml),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string().optional(),
  role: z.enum(ROLE_NAMES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  departmentId: z.string().optional(),
  departmentIds: z.array(z.string().min(1)).optional(),
  avatarUrl: z.string().url().optional(),
  companyPhone: z.string().optional().transform(stripHtmlOptional),
  auxiliaryPhone: z.string().optional().transform(stripHtmlOptional),
  branchId: z.string().min(1),
  visibleBranchIds: z.array(z.string().min(1)).optional(),
  skillIds: z.array(z.string().min(1)).optional(),
});

export const updateUserBodySchema = createUserBodySchema
  .omit({ password: true })
  .partial()
  .extend({
    departmentId: z.string().optional().nullable(),
    departmentIds: z.array(z.string().min(1)).optional(),
  });

export const changeStatusBodySchema = z.object({
  status: z.enum(USER_STATUSES),
});

export const changeRoleBodySchema = z.object({
  roleId: z.string().optional(),
  role: z.enum(ROLE_NAMES).optional(),
});

export const resetPasswordBodySchema = z.object({
  newPassword: z.string().min(8),
});

export const userSchedulesQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

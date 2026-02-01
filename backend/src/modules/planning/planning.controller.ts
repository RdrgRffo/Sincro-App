import type { Response } from 'express';
import { isAppError } from '../../common/errors/app-error';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { planningService } from './planning.service';
import { planningManager } from './planning.manager';
import type { PlanningActor } from './planning.types';
import {
  notificationPreferencesBodySchema,
  planningCommentBodySchema,
  planningCommentsQuerySchema,
  planningRangeQuerySchema,
  planningSubstitutesQuerySchema,
  planningTemplatePreviewQuerySchema,
  absenceImpactQuerySchema,
} from './planning.validation';

function buildPlanningActor(req: AuthRequest): PlanningActor {
  return {
    id: req.user!.id,
    roleName: req.user!.roleName!,
    branchId: req.user!.branchId,
    departmentId: req.user!.departmentId,
    permissions: req.user!.permissions ?? [],
    visibleBranchIds: req.user!.visibleBranchIds ?? [],
  };
}

function parseRangeQuery(req: AuthRequest, res: Response) {
  const parsed = planningRangeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
    return null;
  }
  return parsed.data;
}

/**
 * Get coverage risks for the planning dashboard.
 */
export async function getCoverageRisksController(req: AuthRequest, res: Response) {
  const filters = parseRangeQuery(req, res);
  if (!filters) return;

  try {
    const risks = await planningService.getCoverageRisks(filters, buildPlanningActor(req));
    return sendSuccess(res, risks);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * Get employee availability for the planning dashboard.
 * Supports pagination via page/pageSize query params.
 */
export async function getAvailabilityController(req: AuthRequest, res: Response) {
  const filters = parseRangeQuery(req, res);
  if (!filters) return;

  try {
    const actor = buildPlanningActor(req);
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    const [availability, total] = await Promise.all([
      planningService.getAvailability(filters, actor),
      planningManager.countUsersInScope(scopedFilters),
    ]);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 200;

    return sendSuccess(res, {
      data: availability,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * Get daily availability matrix for the planning dashboard.
 * Supports pagination via page/pageSize query params.
 */
export async function getAvailabilityMatrixController(req: AuthRequest, res: Response) {
  const filters = parseRangeQuery(req, res);
  if (!filters) return;

  try {
    const actor = buildPlanningActor(req);
    const scopedFilters = await planningManager.resolveScopedFilters(filters, actor);
    const [matrix, total] = await Promise.all([
      planningService.getAvailabilityMatrix(filters, actor),
      planningManager.countUsersInScope(scopedFilters),
    ]);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 200;

    return sendSuccess(res, {
      ...matrix,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getSubstituteSuggestionsController(req: AuthRequest, res: Response) {
  const parsed = planningSubstitutesQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const suggestions = await planningService.getSubstituteSuggestions(parsed.data, buildPlanningActor(req));
    return sendSuccess(res, suggestions);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getEquityController(req: AuthRequest, res: Response) {
  const filters = parseRangeQuery(req, res);
  if (!filters) return;

  try {
    const equity = await planningService.getEquity(filters, buildPlanningActor(req));
    return sendSuccess(res, equity);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getTimelineController(req: AuthRequest, res: Response) {
  const filters = parseRangeQuery(req, res);
  if (!filters) return;

  try {
    const timeline = await planningService.getTimeline(filters, buildPlanningActor(req));
    return sendSuccess(res, timeline);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getCrisisModeController(req: AuthRequest, res: Response) {
  const filters = parseRangeQuery(req, res);
  if (!filters) return;

  try {
    const crisis = await planningService.getCrisisMode(filters, buildPlanningActor(req));
    return sendSuccess(res, crisis);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getTemplatePreviewController(req: AuthRequest, res: Response) {
  const parsed = planningTemplatePreviewQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const preview = await planningService.getTemplatePreview(parsed.data, buildPlanningActor(req));
    return sendSuccess(res, preview);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getNotificationPreferencesController(req: AuthRequest, res: Response) {
  try {
    const preferences = await planningService.getNotificationPreferences(buildPlanningActor(req));
    return sendSuccess(res, preferences);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function updateNotificationPreferencesController(req: AuthRequest, res: Response) {
  const parsed = notificationPreferencesBodySchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const preferences = await planningService.updateNotificationPreferences(buildPlanningActor(req), parsed.data);
    return sendSuccess(res, preferences, 'Preferencias actualizadas');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getAbsenceImpactController(req: AuthRequest, res: Response) {
  const parsed = absenceImpactQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const impact = await planningService.getAbsenceImpact(parsed.data, buildPlanningActor(req));
    return sendSuccess(res, impact);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function listCommentsController(req: AuthRequest, res: Response) {
  const parsed = planningCommentsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const comments = await planningService.listComments(parsed.data);
    return sendSuccess(res, comments);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function addCommentController(req: AuthRequest, res: Response) {
  const parsed = planningCommentBodySchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const comment = await planningService.addComment(parsed.data, buildPlanningActor(req));
    return sendSuccess(res, comment, 'Comentario agregado', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

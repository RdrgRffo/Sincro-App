import { Response } from 'express';
import { isAppError } from '../../common/errors/app-error';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { skillsService } from './skills.service';
import {
  assignUserSkillsBodySchema,
  createSkillBodySchema,
  listSkillsQuerySchema,
  skillIdParamsSchema,
  updateSkillBodySchema,
  userSkillParamsSchema,
} from './skills.validation';

function buildSkillActor(req: AuthRequest) {
  return { id: req.user!.id, ipAddress: req.ip };
}

export async function listSkillsController(req: AuthRequest, res: Response) {
  const parsed = listSkillsQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  return sendSuccess(res, await skillsService.listSkills(parsed.data));
}

export async function createSkillController(req: AuthRequest, res: Response) {
  const parsed = createSkillBodySchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const skill = await skillsService.createSkill(parsed.data, buildSkillActor(req));
    return sendSuccess(res, skill, 'Skill creada', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function updateSkillController(req: AuthRequest, res: Response) {
  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  const parsedBody = updateSkillBodySchema.safeParse(req.body);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  if (!parsedBody.success) return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    const skill = await skillsService.updateSkill(parsedParams.data.id, parsedBody.data, buildSkillActor(req));
    return sendSuccess(res, skill, 'Skill actualizada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function deleteSkillController(req: AuthRequest, res: Response) {
  const parsed = skillIdParamsSchema.safeParse(req.params);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const skill = await skillsService.deleteSkill(parsed.data.id, buildSkillActor(req));
    return sendSuccess(res, skill, 'Skill desactivada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function reactivateSkillController(req: AuthRequest, res: Response) {
  const parsed = skillIdParamsSchema.safeParse(req.params);
  if (!parsed.success) return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const skill = await skillsService.reactivateSkill(parsed.data.id, buildSkillActor(req));
    return sendSuccess(res, skill, 'Skill reactivada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getSkillStatsController(req: AuthRequest, res: Response) {
  try {
    const stats = await skillsService.getSkillStats();
    return sendSuccess(res, stats);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function assignUserSkillsController(req: AuthRequest, res: Response) {
  const parsedParams = userSkillParamsSchema.safeParse(req.params);
  const parsedBody = assignUserSkillsBodySchema.safeParse(req.body);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  if (!parsedBody.success) return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    const skills = await skillsService.assignUserSkills(
      parsedParams.data.userId,
      parsedBody.data.skillIds,
      buildSkillActor(req),
    );
    return sendSuccess(res, skills, 'Skills asignadas');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

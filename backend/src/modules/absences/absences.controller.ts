import { Response } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth.middleware';
import { isAppError } from '../../common/errors/app-error';
import {
  listAbsences,
  getAbsenceById,
  createAbsenceEntry,
  approveAbsenceEntry,
  rejectAbsenceEntry,
  cancelAbsenceEntry,
  getAbsenceCalendar,
} from './absences.service';
import {
  createAbsenceRequestSchema,
  approveAbsenceSchema,
  rejectAbsenceSchema,
  absenceIdParamsSchema,
  listAbsencesQuerySchema,
  absenceCalendarQuerySchema,
} from './absences.http.schemas';

function buildActor(req: AuthRequest) {
  return {
    id: req.user!.id,
    roleName: req.user!.roleName!,
    email: req.user!.email,
    name: req.user!.name,
    branchId: req.user!.branchId,
    visibleBranchIds: req.user!.visibleBranchIds ?? [],
    departmentId: req.user!.departmentId,
    ipAddress: req.ip,
    permissions: req.user!.permissions ?? [],
  };
}

export async function listAbsencesController(req: AuthRequest, res: Response) {
  const parsed = listAbsencesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const data = await listAbsences(parsed.data, buildActor(req));
    return sendSuccess(res, data);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getAbsenceController(req: AuthRequest, res: Response) {
  const parsed = absenceIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const absence = await getAbsenceById(parsed.data.id, buildActor(req));
    return sendSuccess(res, absence);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function createAbsenceController(req: AuthRequest, res: Response) {
  const parsed = createAbsenceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const result = await createAbsenceEntry(parsed.data, buildActor(req));

    const { hasOverlap, overlappingEmployees, ...absence } = result as any;
    const message = hasOverlap
      ? 'Solicitud creada con advertencia: las fechas coinciden con ausencias de compañeros del departamento'
      : 'Solicitud de ausencia creada';

    return sendSuccess(res, {
      ...absence,
      hasOverlap,
      overlappingEmployees,
    }, message, 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function approveAbsenceController(req: AuthRequest, res: Response) {
  const parsedParams = absenceIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = approveAbsenceSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const absence = await approveAbsenceEntry(parsedParams.data.id, parsedBody.data, buildActor(req));
    return sendSuccess(res, absence, 'Ausencia aprobada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function rejectAbsenceController(req: AuthRequest, res: Response) {
  const parsedParams = absenceIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = rejectAbsenceSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const absence = await rejectAbsenceEntry(parsedParams.data.id, parsedBody.data, buildActor(req));
    return sendSuccess(res, absence, 'Ausencia rechazada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function cancelAbsenceController(req: AuthRequest, res: Response) {
  const parsed = absenceIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const absence = await cancelAbsenceEntry(parsed.data.id, buildActor(req));
    return sendSuccess(res, absence, 'Solicitud de ausencia cancelada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getAbsenceCalendarController(req: AuthRequest, res: Response) {
  const parsed = absenceCalendarQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const calendar = await getAbsenceCalendar(
      parsed.data.year,
      parsed.data.week,
      parsed.data.branchId,
      parsed.data.departmentId,
      parsed.data.employeeId,
      buildActor(req),
      parsed.data.from,
      parsed.data.to,
    );
    return sendSuccess(res, calendar);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

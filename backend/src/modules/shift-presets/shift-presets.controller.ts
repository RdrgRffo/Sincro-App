import { Response } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth.middleware';
import { isAppError } from '../../common/errors/app-error';
import * as shiftPresetsService from './shift-presets.service';
import { createShiftPresetSchema, updateShiftPresetSchema, applyShiftPresetSchema, previewShiftPresetSchema } from './shift-presets.http.schemas';

function getParamId(req: AuthRequest): string {
  return String(req.params.id);
}

function sendShiftPresetError(res: Response, error: unknown) {
  if (isAppError(error)) {
    return sendError(res, error.message, error.statusCode, error.details, error.code);
  }

  throw error;
}

export async function listShiftPresetsController(req: AuthRequest, res: Response) {
  try {
    const includeInactive = String(req.query.includeInactive ?? '').toLowerCase() === 'true'
      || req.query.includeInactive === '1';
    const presets = await shiftPresetsService.listShiftPresets({ includeInactive });
    return sendSuccess(res, presets);
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function getShiftPresetController(req: AuthRequest, res: Response) {
  try {
    const preset = await shiftPresetsService.getShiftPresetById(getParamId(req));
    return sendSuccess(res, preset);
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function createShiftPresetController(req: AuthRequest, res: Response) {
  const parsed = createShiftPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const preset = await shiftPresetsService.createShiftPreset(parsed.data, req.user!.id);
    return sendSuccess(res, preset, 'Preset creado', 201);
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function updateShiftPresetController(req: AuthRequest, res: Response) {
  const parsed = updateShiftPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const preset = await shiftPresetsService.updateShiftPreset(getParamId(req), parsed.data, req.user!.id);
    return sendSuccess(res, preset);
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function deleteShiftPresetController(req: AuthRequest, res: Response) {
  try {
    await shiftPresetsService.deleteShiftPreset(getParamId(req), req.user!.id);
    return sendSuccess(res, null, 'Preset eliminado');
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function reactivateShiftPresetController(req: AuthRequest, res: Response) {
  try {
    const preset = await shiftPresetsService.reactivateShiftPreset(getParamId(req), { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, preset, 'Shift preset reactivado');
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function applyShiftPresetController(req: AuthRequest, res: Response) {
  const parsed = applyShiftPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const result = await shiftPresetsService.applyShiftPreset(getParamId(req), parsed.data, {
      id: req.user!.id,
      roleName: req.user!.roleName ?? 'employee',
      email: req.user!.email,
      name: req.user!.name,
      branchId: req.user!.branchId,
      visibleBranchIds: req.user!.visibleBranchIds,
      ipAddress: req.ip,
    });
    return sendSuccess(res, result, `Preset aplicado: ${result.totalCreated} turnos creados`);
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

export async function previewShiftPresetController(req: AuthRequest, res: Response) {
  const parsed = previewShiftPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const result = await shiftPresetsService.previewShiftPreset(getParamId(req), parsed.data);
    return sendSuccess(res, result);
  } catch (error: unknown) {
    return sendShiftPresetError(res, error);
  }
}

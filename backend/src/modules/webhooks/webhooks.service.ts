import { prisma } from '../../config/database';
import { createAppError } from '../../common/errors/error-catalog';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { logAuditOrThrow } from '../audit/audit.service';

export type WebhookCreatePayload = {
  name: string;
  webhookUrl: string;
  enabled: boolean;
  notifyModifications: boolean;
  notifyLastMinute: boolean;
  fridayReminderEnabled: boolean;
  mondayAbsenceReminderEnabled: boolean;
  fridayReminderTime: string;
  departmentId?: string | null;
  branchId?: string | null;
};

/** Si hay sucursal y departamento, deben estar enlazados en `department_branches`. */
export async function assertWebhookBranchDepartmentConsistency(
  branchId?: string | null | undefined,
  departmentId?: string | null | undefined,
): Promise<void> {
  const b = typeof branchId === 'string' ? branchId.trim() : '';
  const d = typeof departmentId === 'string' ? departmentId.trim() : '';
  if (!b || !d) return;

  const link = await prisma.departmentBranch.findUnique({
    where: { departmentId_branchId: { departmentId: d, branchId: b } },
    select: { departmentId: true },
  });
  if (!link) {
    throw createAppError('BAD_REQUEST', 'El departamento no está asociado a la sucursal seleccionada');
  }
}

export async function createWebhook(data: WebhookCreatePayload, actorId: string, ipAddress?: string) {
  await assertWebhookBranchDepartmentConsistency(data.branchId, data.departmentId);

  const prismaData = {
    name: data.name,
    webhookUrl: data.webhookUrl,
    enabled: data.enabled,
    notifyModifications: data.notifyModifications,
    notifyLastMinute: data.notifyLastMinute,
    fridayReminderEnabled: data.fridayReminderEnabled,
    mondayAbsenceReminderEnabled: data.mondayAbsenceReminderEnabled,
    fridayReminderTime: data.fridayReminderTime,
    departmentId: data.departmentId?.trim() ? data.departmentId.trim() : null,
    branchId: data.branchId?.trim() ? data.branchId.trim() : null,
  };

  return executeInTransaction(async (tx) => {
    const webhook = await tx.webhookConfig.create({ data: prismaData });

    await logAuditOrThrow({
      userId: actorId,
      action: 'CREATE_WEBHOOK',
      entityType: 'WebhookConfig',
      entityId: webhook.id,
      detailsJson: { before: null, after: webhook },
      ipAddress,
    }, tx);

    return webhook;
  });
}

export async function updateWebhook(id: string, data: Partial<{
  name: string;
  webhookUrl: string;
  enabled: boolean;
  notifyModifications: boolean;
  notifyLastMinute: boolean;
  fridayReminderEnabled: boolean;
  mondayAbsenceReminderEnabled: boolean;
  fridayReminderTime: string;
  departmentId?: string | null;
  branchId?: string | null;
}>, actorId: string, ipAddress?: string) {
  return executeInTransaction(async (tx) => {
    const existing = await tx.webhookConfig.findUnique({ where: { id } });
    if (!existing) throw createAppError('NOT_FOUND', 'Webhook no encontrado');

    const normalizePatchId = (v: string | null | undefined): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const t = String(v).trim();
      return t || null;
    };

    const patchBranchId = 'branchId' in data ? normalizePatchId(data.branchId) : undefined;
    const patchDepartmentId = 'departmentId' in data ? normalizePatchId(data.departmentId) : undefined;

    const nextBranchId = patchBranchId === undefined ? existing.branchId : patchBranchId;
    const nextDepartmentId = patchDepartmentId === undefined ? existing.departmentId : patchDepartmentId;

    await assertWebhookBranchDepartmentConsistency(nextBranchId, nextDepartmentId);

    const { branchId: _b, departmentId: _d, ...rest } = data;
    const updateData = {
      ...rest,
      ...(patchBranchId !== undefined ? { branchId: patchBranchId } : {}),
      ...(patchDepartmentId !== undefined ? { departmentId: patchDepartmentId } : {}),
    };

    const webhook = await tx.webhookConfig.update({
      where: { id },
      data: updateData,
    });

    await logAuditOrThrow({
      userId: actorId,
      action: 'UPDATE_WEBHOOK',
      entityType: 'WebhookConfig',
      entityId: id,
      detailsJson: { before: existing, after: webhook },
      ipAddress,
    }, tx);

    return webhook;
  });
}

export async function deleteWebhook(id: string, actorId: string, ipAddress?: string) {
  return executeInTransaction(async (tx) => {
    const existing = await tx.webhookConfig.findUnique({ where: { id } });
    if (!existing) throw createAppError('NOT_FOUND', 'Webhook no encontrado');

    await tx.webhookConfig.delete({ where: { id } });

    await logAuditOrThrow({
      userId: actorId,
      action: 'DELETE_WEBHOOK',
      entityType: 'WebhookConfig',
      entityId: id,
      detailsJson: { before: existing, after: null },
      ipAddress,
    }, tx);
  });
}

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import type { AuthRequest } from '../../middleware/auth.middleware';

type Actor = NonNullable<AuthRequest['user']>;

export function canBypassWebhookScope(user: Pick<Actor, 'roleName' | 'permissions'>): boolean {
  const perms = (user.permissions ?? []) as string[];
  return user.roleName === 'admin' || perms.includes('webhooks:manage');
}

/** Sucursales visibles para el actor (sede propia + sucursales enlazadas). */
export function actorVisibleBranchIds(user: Pick<Actor, 'branchId' | 'visibleBranchIds'>): string[] {
  return [...new Set([user.branchId, ...(user.visibleBranchIds ?? [])].filter(Boolean))] as string[];
}

/**
 * Webhooks que el actor puede usar para envíos / historial cuando no es admin ni tiene webhooks:manage.
 * Excluye webhooks "globales" (sin sede ni departamento): solo admin los gestiona.
 */
export function webhookBranchScopeWhere(
  user: Pick<Actor, 'branchId' | 'visibleBranchIds'>,
): Prisma.WebhookConfigWhereInput {
  const ids = actorVisibleBranchIds(user);
  if (!ids.length) {
    return { id: '__no_branch_scope__' };
  }
  return {
    AND: [
      {
        OR: [{ branchId: { not: null } }, { departmentId: { not: null } }],
      },
      {
        OR: [
          { branchId: { in: ids } },
          {
            department: {
              branches: { some: { branchId: { in: ids } } },
            },
          },
        ],
      },
    ],
  };
}

export async function assertExplicitWebhookIdsInActorScope(
  user: Actor,
  webhookConfigIds: string[],
): Promise<void> {
  const unique = [...new Set(webhookConfigIds)];
  if (!unique.length) return;
  if (canBypassWebhookScope(user)) return;
  const scope = webhookBranchScopeWhere(user);
  const count = await prisma.webhookConfig.count({
    where: { AND: [{ id: { in: unique } }, { enabled: true }, scope] },
  });
  if (count !== unique.length) {
    throw new Error('Uno o más webhooks no están en el ámbito de tu sede');
  }
}

export async function findWebhooksForManualAnnounce(
  user: Actor,
  webhookConfigIds: string[] | undefined,
): Promise<Array<{ id: string; webhookUrl: string }>> {
  if (Array.isArray(webhookConfigIds)) {
    await assertExplicitWebhookIdsInActorScope(user, webhookConfigIds);
  }
  const base: Prisma.WebhookConfigWhereInput = { enabled: true };
  const scoped: Prisma.WebhookConfigWhereInput = canBypassWebhookScope(user)
    ? base
    : { AND: [base, webhookBranchScopeWhere(user)] };

  const where: Prisma.WebhookConfigWhereInput = Array.isArray(webhookConfigIds)
    ? { AND: [scoped, { id: { in: webhookConfigIds } }] }
    : scoped;

  return prisma.webhookConfig.findMany({
    where,
    select: { id: true, webhookUrl: true },
  });
}

export async function resolveFridaySummaryWebhookIds(
  user: Actor,
  webhookConfigIds: string[] | undefined,
): Promise<string[] | undefined> {
  if (canBypassWebhookScope(user)) {
    return webhookConfigIds;
  }
  const scope = webhookBranchScopeWhere(user);
  if (webhookConfigIds !== undefined) {
    await assertExplicitWebhookIdsInActorScope(user, webhookConfigIds);
    return webhookConfigIds;
  }
  const rows = await prisma.webhookConfig.findMany({
    where: {
      AND: [{ enabled: true }, { fridayReminderEnabled: true }, scope],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function resolveAbsenceSummaryWebhookIds(
  user: Actor,
  webhookConfigIds: string[] | undefined,
): Promise<string[] | undefined> {
  if (canBypassWebhookScope(user)) {
    return webhookConfigIds;
  }
  const scope = webhookBranchScopeWhere(user);
  if (webhookConfigIds !== undefined) {
    await assertExplicitWebhookIdsInActorScope(user, webhookConfigIds);
    return webhookConfigIds;
  }
  const rows = await prisma.webhookConfig.findMany({
    where: {
      AND: [{ enabled: true }, { mondayAbsenceReminderEnabled: true }, scope],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export function notificationLogScopeWhere(user: Actor): Prisma.NotificationLogWhereInput | null {
  if (canBypassWebhookScope(user)) return null;
  const whScope = webhookBranchScopeWhere(user);
  return {
    OR: [{ webhookConfigId: null }, { webhookConfig: { is: whScope } }],
  };
}

export async function assertWebhookLogResendAllowed(user: Actor, logId: string): Promise<void> {
  const log = await prisma.notificationLog.findUnique({
    where: { id: logId },
    select: { webhookConfigId: true },
  });
  if (!log) throw new Error('Notificación no encontrada');
  if (!log.webhookConfigId) return;
  if (canBypassWebhookScope(user)) return;
  const scope = webhookBranchScopeWhere(user);
  const ok = await prisma.webhookConfig.count({
    where: { AND: [{ id: log.webhookConfigId }, scope] },
  });
  if (!ok) {
    throw new Error('No puedes reenviar notificaciones de webhooks fuera de tu sede');
  }
}

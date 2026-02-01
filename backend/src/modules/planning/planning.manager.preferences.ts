import { prisma } from '../../config/database';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { logAuditOrThrow } from '../audit/audit.service';
import type { PlanningActor } from './planning.types';
import type { NotificationPreferencesInput } from './planning.validation';

export class PlanningPreferencesManager {
  /**
   * Read preferences, creating defaults for first-time users.
   */
  async getNotificationPreferences(actor: PlanningActor) {
    return prisma.userNotificationPreference.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id },
      update: {},
    });
  }

  /**
   * Update notification preferences for the current actor.
   */
  async updateNotificationPreferences(
    actor: PlanningActor,
    data: NotificationPreferencesInput,
  ) {
    return executeInTransaction(async (tx) => {
      const previous = await tx.userNotificationPreference.findUnique({ where: { userId: actor.id } });
      const updated = await tx.userNotificationPreference.upsert({
        where: { userId: actor.id },
        create: { userId: actor.id, ...data },
        update: data,
      });
      await logAuditOrThrow({
        userId: actor.id,
        action: 'UPDATE_PLANNING_NOTIFICATION_PREFERENCES',
        entityType: 'UserNotificationPreference',
        entityId: actor.id,
        detailsJson: {
          before: previous,
          after: updated,
        },
      }, tx);
      return updated;
    });
  }
}

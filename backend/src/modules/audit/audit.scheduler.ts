import cron from 'node-cron';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

/**
 * @description Retention period for audit logs in days.
 * Logs older than this will be automatically deleted.
 */
const AUDIT_RETENTION_DAYS = 365;

/**
 * @description Cleans up audit logs older than AUDIT_RETENTION_DAYS.
 * Runs daily at 03:00 AM.
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS);

  logger.info(`Cleaning up audit logs older than ${cutoffDate.toISOString()} (${AUDIT_RETENTION_DAYS} days retention)...`);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  if (result.count > 0) {
    logger.info(`Cleaned up ${result.count} old audit log(s)`);
  } else {
    logger.info('No audit logs to clean up');
  }

  return result.count;
}

export function startAuditScheduler() {
  // Every day at 03:00 AM — cleanup old audit logs
  cron.schedule(
    '0 3 * * *',
    async () => {
      try {
        await cleanupOldAuditLogs();
      } catch (err) {
        logger.error('Audit cleanup scheduler error:', err);
      }
    },
    { timezone: 'Europe/Madrid' }
  );

  logger.info('Audit scheduler started (daily 03:00 Europe/Madrid)');
}

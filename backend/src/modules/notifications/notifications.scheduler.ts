import cron from 'node-cron';
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { buildFridaySummaryCard, buildMondayAbsenceCard } from './notifications.templates';
import { sendToWebhook } from './notifications.service';

export async function sendFridaySummary(sentByUserId?: string, webhookConfigIds?: string[]) {
  logger.info('Sending Friday schedule summary...');

  const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

  const schedules = await prisma.schedule.findMany({
    where: {
      startDatetime: { gte: nextWeekStart },
      endDatetime: { lte: nextWeekEnd },
    },
    include: {
      assignments: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { startDatetime: 'asc' },
  });

  const weekDays = eachDayOfInterval({ start: nextWeekStart, end: nextWeekEnd });

  const days = weekDays.map((day) => {
    const daySchedules = schedules.filter((s) =>
      isWithinInterval(new Date(s.startDatetime), {
        start: new Date(day.setHours(0, 0, 0, 0)),
        end: new Date(new Date(day).setHours(23, 59, 59, 999)),
      })
    );

    return {
      dayLabel: format(day, "EEEE dd 'de' MMMM", { locale: es }),
      schedules: daySchedules.map((s) => ({
        title: s.title,
        time: `${format(s.startDatetime, 'HH:mm')} - ${format(s.endDatetime, 'HH:mm')}`,
        assignees: s.assignments.map((a) => a.user.name),
        location: s.location,
      })),
    };
  });

  const weekLabel = `${format(nextWeekStart, "dd 'de' MMMM", { locale: es })} — ${format(nextWeekEnd, "dd 'de' MMMM yyyy", { locale: es })}`;
  const card = buildFridaySummaryCard({ weekLabel, days });

  let webhooks;
  if (webhookConfigIds) {
    webhooks = await prisma.webhookConfig.findMany({
      where: { id: { in: webhookConfigIds }, enabled: true },
    });
  } else {
    webhooks = await prisma.webhookConfig.findMany({
      where: { enabled: true, fridayReminderEnabled: true },
    });
  }

  const results = [];
  for (const webhook of webhooks) {
    const result = await sendToWebhook({
      webhookConfigId: webhook.id,
      webhookUrl: webhook.webhookUrl,
      payload: card,
      type: 'friday_reminder',
      message: `Planificación semana ${weekLabel}`,
      sentByUserId,
    });
    results.push(result);
  }

  logger.info(`Friday summary sent to ${results.length} webhook(s)`);
  return results;
}

export async function sendMondayAbsenceSummary(sentByUserId?: string, webhookConfigIds?: string[]) {
  logger.info('Sending Monday absence summary...');

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const absenceRows = await prisma.absence.findMany({
    where: {
      status: 'approved',
      AND: [
        { startDate: { lte: weekEnd } },
        { endDate: { gte: weekStart } },
      ],
    },
    include: {
      employee: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  const absences = absenceRows.map((v) => ({
    name: v.employee.name,
    from: format(new Date(v.startDate), 'dd/MM/yyyy'),
    to: format(new Date(v.endDate), 'dd/MM/yyyy'),
  }));

  const weekLabel = `${format(weekStart, "dd 'de' MMMM", { locale: es })} — ${format(weekEnd, "dd 'de' MMMM yyyy", { locale: es })}`;
  const card = buildMondayAbsenceCard({ weekLabel, absences });

  let webhooks;
  if (webhookConfigIds) {
    webhooks = await prisma.webhookConfig.findMany({
      where: { id: { in: webhookConfigIds }, enabled: true },
    });
  } else {
    webhooks = await prisma.webhookConfig.findMany({
      where: { enabled: true, mondayAbsenceReminderEnabled: true },
    });
  }

  const results = [];
  for (const webhook of webhooks) {
    const result = await sendToWebhook({
      webhookConfigId: webhook.id,
      webhookUrl: webhook.webhookUrl,
      payload: card,
      type: 'monday_absence_summary',
      message: `Ausencias semana ${weekLabel}`,
      sentByUserId,
    });
    results.push(result);
  }

  logger.info(`Monday absence summary sent to ${results.length} webhook(s) — ${absences.length} people on absence`);
  return results;
}

export function startScheduler() {
  // Every Friday at 12:00 PM — weekly schedule summary
  cron.schedule(
    '0 12 * * 5',
    async () => {
      try {
        await sendFridaySummary();
      } catch (err) {
        logger.error('Friday scheduler error:', err);
      }
    },
    { timezone: 'Europe/Madrid' }
  );

  // Every Monday at 8:30 AM — absence summary for the current week
  cron.schedule(
    '30 8 * * 1',
    async () => {
      try {
        await sendMondayAbsenceSummary();
      } catch (err) {
        logger.error('Monday absence scheduler error:', err);
      }
    },
    { timezone: 'Europe/Madrid' }
  );

  logger.info('Notification scheduler started (Friday 12:00 + Monday 08:30 Europe/Madrid)');
}

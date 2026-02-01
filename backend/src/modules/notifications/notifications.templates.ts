import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formatea una fecha con timezone opcional.
 * Si se proporciona timezone, usa Intl.DateTimeFormat (timezone-aware).
 * Si no, usa date-fns con locale español (fallback).
 */
function formatDt(dt: Date | string, timezone?: string): string {
  const d = new Date(dt);
  if (timezone) {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(d);
  }
  return format(d, "EEEE dd/MM/yyyy 'a las' HH:mm", { locale: es });
}

export function buildScheduleCard(params: {
  type: string;
  title: string;
  startDatetime: Date | string;
  endDatetime: Date | string;
  assignees: string[];
  location?: string | null;
  reason: string;
  actor: string;
  isLastMinute: boolean;
  branchTimezone?: string;
}) {
  const typeLabels: Record<string, string> = {
    schedule_created: '✅ NUEVA GUARDIA PROGRAMADA',
    schedule_modified: '✏️ GUARDIA MODIFICADA',
    schedule_deleted: '🗑️ GUARDIA ELIMINADA',
    schedule_lastminute: '⚠️ CAMBIO DE ÚLTIMO MOMENTO',
  };

  const titleText = typeLabels[params.type] || '📅 ACTUALIZACIÓN DE GUARDIA';
  const color = params.isLastMinute ? 'attention' : params.type === 'schedule_created' ? 'good' : 'warning';

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: titleText,
              size: 'Large',
              weight: 'Bolder',
              color,
              wrap: true,
            },
            params.isLastMinute
              ? {
                  type: 'TextBlock',
                  text: '⚠️ Este cambio se ha realizado con menos de 24 horas de antelación',
                  color: 'attention',
                  isSubtle: true,
                  wrap: true,
                }
              : null,
            {
              type: 'FactSet',
              facts: [
                { title: '📋 Guardia:', value: params.title },
                { title: '🕐 Inicio:', value: formatDt(params.startDatetime, params.branchTimezone) },
                { title: '🕕 Fin:', value: formatDt(params.endDatetime, params.branchTimezone) },
                { title: '👥 Personal:', value: params.assignees.join(', ') || 'Sin asignar' },
                ...(params.location ? [{ title: '📍 Ubicación:', value: params.location }] : []),
                { title: '📝 Motivo:', value: params.reason },
                { title: '👤 Modificado por:', value: params.actor },
              ].filter(Boolean),
            },
          ].filter(Boolean),
          msteams: { width: 'Full' },
        },
      },
    ],
  };
}

export function buildFridaySummaryCard(params: {
  weekLabel: string;
  days: Array<{
    dayLabel: string;
    schedules: Array<{ title: string; time: string; assignees: string[]; location?: string | null }>;
  }>;
}) {
  const dayBlocks = params.days.flatMap((day) => {
    if (day.schedules.length === 0) return [];
    return [
      {
        type: 'TextBlock',
        text: `📅 **${day.dayLabel}**`,
        weight: 'Bolder',
        size: 'Medium',
        spacing: 'Medium',
        color: 'accent',
      },
      ...day.schedules.flatMap((s, index) => [
        {
          type: 'FactSet',
          facts: [
            { title: '📋 Guardia:', value: s.title },
            { title: '🕐 Horario:', value: s.time },
            { title: '👥 Personal:', value: s.assignees.join(', ') || 'Sin asignar' },
            ...(s.location ? [{ title: '📍 Lugar:', value: s.location }] : []),
          ],
        },
        ...(index < day.schedules.length - 1
          ? [
              {
                type: 'TextBlock',
                text: '────────────────────',
                isSubtle: true,
                spacing: 'Small',
              },
            ]
          : []),
      ]),
    ];
  });

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: `📊 PLANIFICACIÓN DE LA SEMANA`,
              size: 'ExtraLarge',
              weight: 'Bolder',
              color: 'accent',
            },
            {
              type: 'TextBlock',
              text: params.weekLabel,
              size: 'Medium',
              isSubtle: true,
              wrap: true,
              spacing: 'Small',
            },
            ...(dayBlocks.length > 0
              ? dayBlocks
              : [{ type: 'TextBlock', text: 'No hay guardias programadas para esta semana.', isSubtle: true, wrap: true }]),
          ],
        },
      },
    ],
  };
}

export function buildMondayAbsenceCard(params: {
  weekLabel: string;
  absences: Array<{ name: string; from: string; to: string }>;
}) {
  const bodyBlocks = params.absences.length > 0
    ? [
        {
          type: 'TextBlock',
          text: `Se ${params.absences.length === 1 ? 'encuentra' : 'encuentran'} de ausencia esta semana:`,
          wrap: true,
          isSubtle: true,
          spacing: 'Small',
        },
        {
          type: 'FactSet',
          facts: params.absences.map((v) => ({
            title: `📅 ${v.name}:`,
            value: v.from === v.to ? v.from : `${v.from} – ${v.to}`,
          })),
        },
      ]
    : [
        {
          type: 'TextBlock',
          text: '✅ No hay ausencias aprobadas esta semana.',
          wrap: true,
          color: 'good',
        },
      ];

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: '📅 AUSENCIAS DE LA SEMANA',
              size: 'ExtraLarge',
              weight: 'Bolder',
              color: 'accent',
            },
            {
              type: 'TextBlock',
              text: params.weekLabel,
              size: 'Medium',
              isSubtle: true,
              wrap: true,
              spacing: 'Small',
            },
            ...bodyBlocks,
          ],
        },
      },
    ],
  };
}

export function buildTestCard(webhookName: string) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: '🔔 Mensaje de Prueba', size: 'Large', weight: 'Bolder', color: 'good' },
            { type: 'TextBlock', text: `El webhook **${webhookName}** está correctamente configurado.`, wrap: true },
            { type: 'TextBlock', text: format(new Date(), "dd/MM/yyyy HH:mm:ss"), isSubtle: true, size: 'Small' },
          ],
        },
      },
    ],
  };
}

export function buildAbsenceCard(params: {
  type: string;
  employeeName: string;
  startDate: Date | string;
  endDate: Date | string;
  note?: string | null;
  actor: string;
  rejectionReason?: string | null;
  branchTimezone?: string;
}) {
  const typeLabels: Record<string, string> = {
    absence_requested: '📋 NUEVA SOLICITUD DE AUSENCIA',
    absence_approved: '✅ AUSENCIA APROBADA',
    absence_rejected: '❌ AUSENCIA RECHAZADA',
    absence_cancelled: '🗑️ AUSENCIA CANCELADA',
  };

  const titleText = typeLabels[params.type] || '📅 ACTUALIZACIÓN DE AUSENCIAS';
  const isApproved = params.type === 'absence_approved';
  const isRejected = params.type === 'absence_rejected';
  const color = isApproved ? 'good' : isRejected ? 'attention' : 'accent';

  const facts: Array<{ title: string; value: string }> = [
    { title: '👤 Empleado:', value: params.employeeName },
    { title: '📅 Desde:', value: formatDt(params.startDate, params.branchTimezone) },
    { title: '📅 Hasta:', value: formatDt(params.endDate, params.branchTimezone) },
    ...(params.note ? [{ title: '📝 Nota:', value: params.note }] : []),
    ...(params.rejectionReason ? [{ title: '❌ Motivo de rechazo:', value: params.rejectionReason }] : []),
    { title: '👤 Gestionado por:', value: params.actor },
  ];

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: titleText,
              size: 'Large',
              weight: 'Bolder',
              color,
              wrap: true,
            },
            {
              type: 'FactSet',
              facts,
            },
          ].filter(Boolean),
          msteams: { width: 'Full' },
        },
      },
    ],
  };
}

export function buildAnnouncementCard(message: string, sentBy: string) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: '📢 Anuncio', size: 'Large', weight: 'Bolder', color: 'accent' },
            { type: 'TextBlock', text: message, wrap: true, size: 'Medium' },
            { type: 'TextBlock', text: `Enviado por: ${sentBy} — ${format(new Date(), "dd/MM/yyyy HH:mm")}`, isSubtle: true, size: 'Small' },
          ],
        },
      },
    ],
  };
}

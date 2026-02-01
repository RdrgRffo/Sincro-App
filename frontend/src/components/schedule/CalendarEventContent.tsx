import type { EventContentArg } from '@fullcalendar/core';
import { format } from 'date-fns';
import { useScheduleTypes } from '@/hooks/useScheduleTypes';
import { formatTimeInTimezone } from '@/lib/timezone';
import { darkenColor, isMultiDayEvent } from '@/lib/scheduleUtils';
import type { BranchHoliday, Schedule } from '@/types';
import type { FullScheduleType } from './scheduleTypesApi';

const HOLIDAY_COLORS: Record<BranchHoliday['type'], string> = {
  nacional: '#dc2626', autonomica: '#ea580c', local: '#d97706',
  mejora: '#65a30d', regional: '#0ea5e9', company: '#7c3aed',
};

function useGetTypeInfo() {
  const { types: scheduleTypes } = useScheduleTypes();
  return (type: string) => scheduleTypes.find((t: FullScheduleType) => t.value === type) ?? scheduleTypes[0];
}

function useScheduleColor(type: string, fallbackColor?: string): string {
  const getTypeInfo = useGetTypeInfo();
  return getTypeInfo(type)?.color ?? fallbackColor ?? '#1e3a5f';
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6 || /[^0-9a-f]/i.test(normalized)) {
    return `rgba(30, 58, 95, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Obtiene el timezone del schedule desde extendedProps.
 * Si no está disponible, devuelve undefined (se usará la hora local del navegador).
 */
function getScheduleTimezone(event: { extendedProps: Record<string, unknown> }): string | undefined {
  return event.extendedProps.branchTimezone as string | undefined;
}

/* ─── month-view event pill ─────────────────────────────────────── */
export function MonthEventContent({ info }: { info: EventContentArg }) {
  const { event } = info;
  const schedule = event.extendedProps.schedule as Schedule | undefined;
  const tz = getScheduleTimezone(event);
  const color = useScheduleColor(schedule?.type ?? '', schedule?.color);
  const darkerBorder = darkenColor(color, 0.2);
  const timeText = event.start && tz
    ? formatTimeInTimezone(event.start, tz)
    : event.start ? format(event.start, 'HH:mm') : '';

  const multiDay = schedule?.startDatetime && schedule?.endDatetime
    ? isMultiDayEvent(schedule.startDatetime, schedule.endDatetime)
    : false;

  return (
    <div
      className="google-month-event"
      style={{
        backgroundColor: color,
        borderLeft: multiDay ? `4px solid ${darkerBorder}` : `1px solid ${darkerBorder}`,
        borderRadius: '4px',
        padding: '2px 4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      }}
    >
      <span className="google-month-event-time" style={{ color: '#ffffff', fontWeight: 600 }}>
        {timeText}
      </span>
      <span className="google-month-event-title" style={{ color: '#ffffff' }}>{event.title}</span>
      {event.extendedProps.isLastMinute && <span className="google-month-event-flag" style={{ background: 'rgba(255,255,255,0.35)' }}>!</span>}
    </div>
  );
}

/* ─── week/day-view event card ──────────────────────────────────── */
export function TimeGridEventContent({ info }: { info: EventContentArg }) {
  const { event } = info;
  const schedule = event.extendedProps.schedule as Schedule | undefined;
  const tz = getScheduleTimezone(event);
  const color = useScheduleColor(schedule?.type ?? '', schedule?.color);
  const darkerBorder = darkenColor(color, 0.25);

  const timeText = schedule?.startDatetime && schedule?.endDatetime && tz
    ? `${formatTimeInTimezone(schedule.startDatetime, tz)} - ${formatTimeInTimezone(schedule.endDatetime, tz)}`
    : schedule?.startDatetime && schedule?.endDatetime
      ? `${format(new Date(schedule.startDatetime), 'HH:mm')} - ${format(new Date(schedule.endDatetime), 'HH:mm')}`
      : info.timeText;

  const assigneeText = schedule?.assignments?.map((a) => a.user.name.split(' ')[0]).slice(0, 2).join(', ') ?? '';

  const multiDay = schedule?.startDatetime && schedule?.endDatetime
    ? isMultiDayEvent(schedule.startDatetime, schedule.endDatetime)
    : false;

  return (
    <div
      className="google-timegrid-event"
      style={{
        borderLeft: `4px solid ${darkerBorder}`,
        backgroundColor: color,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        borderRadius: multiDay ? '4px 4px 0 0' : '4px',
      }}
    >
      <div className="google-timegrid-event-title" style={{ color: '#ffffff' }}>
        {event.extendedProps.isLastMinute ? '!' : ''} {event.title}
      </div>
      <div className="google-timegrid-event-time">{timeText}</div>
      {assigneeText && <div className="google-timegrid-event-meta">{assigneeText}</div>}
    </div>
  );
}

/* ─── list-view event row ───────────────────────────────────────── */
export function ListEventContent({ info }: { info: EventContentArg }) {
  const { event } = info;
  const schedule = event.extendedProps.schedule as Schedule;
  const tz = getScheduleTimezone(event);
  const color = useScheduleColor(schedule?.type ?? '', schedule?.color);

  const timeText = schedule?.startDatetime && schedule?.endDatetime && tz
    ? `${formatTimeInTimezone(schedule.startDatetime, tz)} - ${formatTimeInTimezone(schedule.endDatetime, tz)}`
    : schedule?.startDatetime && schedule?.endDatetime
      ? `${format(new Date(schedule.startDatetime), 'HH:mm')} - ${format(new Date(schedule.endDatetime), 'HH:mm')}`
      : info.timeText;

  return (
    <div className="google-list-event" style={{ backgroundColor: hexToRgba(color, 0.1), borderLeft: `4px solid ${color}` }}>
      <span className="google-list-event-dot" style={{ backgroundColor: color }} />
      <div className="google-list-event-main">
        <span className="google-list-event-title" style={{ color }}>{event.title}</span>
        <span className="google-list-event-time">{timeText}</span>
      </div>
      {event.extendedProps.isLastMinute && <span className="google-list-event-urgent">Urgente</span>}
    </div>
  );
}

/* ─── holiday event ─────────────────────────────────────────────── */
export function HolidayEventContent({ info }: { info: EventContentArg }) {
  const holidayType = info.event.extendedProps.holidayType as BranchHoliday['type'] | undefined;
  const dotColor = holidayType ? HOLIDAY_COLORS[holidayType] : '#5f6368';

  return (
    <div className="google-holiday-event" style={{ borderColor: '#ddd', color: '#111' }}>
      <span className="google-holiday-event-dot" style={{ backgroundColor: dotColor }} />
      <span className="google-holiday-event-title">{info.event.title}</span>
    </div>
  );
}

/* ─── unified event content dispatcher ─────────────────────────── */
export function EventContent({ info }: { info: EventContentArg }) {
  if (info.event.extendedProps.isHoliday) return <HolidayEventContent info={info} />;
  const viewType = info.view.type;
  if (viewType.startsWith('timeGrid')) return <TimeGridEventContent info={info} />;
  if (viewType.startsWith('list')) return <ListEventContent info={info} />;
  return <MonthEventContent info={info} />;
}

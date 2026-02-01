import FullCalendar from '@fullcalendar/react';
import type { EventMountArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import esLocale from '@fullcalendar/core/locales/es';
import type { DateSelectArg, DatesSetArg, EventClickArg } from '@fullcalendar/core';
import { useRef, useMemo } from 'react';
import { EventContent } from './CalendarEventContent';
import type { Schedule, CalendarBranchHoliday, ScheduleType } from '@/types';
import { toLocalDateOnly, darkenColor } from '@/lib/scheduleUtils';

type ScheduleApiLike = Schedule & {
  scheduleType?: { value?: string | null } | null;
};

interface Props {
  schedules: ScheduleApiLike[] | null;
  branchHolidays: { data?: CalendarBranchHoliday[] } | null;
  scheduleTypes: ScheduleType[];
  canEdit: boolean;
  activeView: string;
  navStateInitialView?: string;
  navStateInitialDate?: string;
  onDateSelect: (info: DateSelectArg) => void;
  onEventClick: (info: EventClickArg) => void;
  onDatesSet: (info: DatesSetArg) => void;
  calendarRef: React.RefObject<FullCalendar | null>;
  onEventMount?: (eventId: string, el: HTMLElement) => void;
  hiddenTypes?: Set<string>;
}


function resolveScheduleType(schedule: ScheduleApiLike, scheduleTypes: ScheduleType[]) {
  // Primero intentar buscar por scheduleTypeId en la lista de tipos conocidos
  if (schedule.scheduleTypeId) {
    const found = scheduleTypes.find((t) => t.value === schedule.scheduleTypeId || t.id === schedule.scheduleTypeId);
    if (found) return found.value;
  }
  // Luego intentar con schedule.type
  const directType = typeof schedule.type === 'string' ? schedule.type.trim() : '';
  if (directType) {
    const found = scheduleTypes.find((t) => t.value === directType);
    if (found) return found.value;
    return directType;
  }
  // Finalmente intentar con schedule.scheduleType?.value
  const relationType = typeof schedule.scheduleType?.value === 'string' ? schedule.scheduleType.value.trim() : '';
  if (relationType) {
    const found = scheduleTypes.find((t) => t.value === relationType);
    if (found) return found.value;
    return relationType;
  }
  return 'unknown';
}

function getTypeInfo(type: string, scheduleTypes: ScheduleType[]) {
  return scheduleTypes.find((t) => t.value === type) ?? { value: type, label: type, color: '#1e3a5f' };
}


export function ScheduleCalendar({ schedules, branchHolidays, scheduleTypes, canEdit, activeView, navStateInitialView, navStateInitialDate, onDateSelect, onEventClick, onDatesSet, calendarRef, onEventMount, hiddenTypes }: Props) {
  const calendarContainerRef = useRef<HTMLDivElement>(null);

  const scheduleEvents = useMemo(() => {
    if (!schedules) return [];
    return schedules
      .filter((s) => {
        if (!hiddenTypes || hiddenTypes.size === 0) return true;
        const scheduleType = resolveScheduleType(s, scheduleTypes);
        return !hiddenTypes.has(scheduleType);
      })
      .map((s) => {
      const scheduleType = resolveScheduleType(s, scheduleTypes);

      const typeInfo = getTypeInfo(scheduleType, scheduleTypes);
      const color = (s as { color?: string }).color || typeInfo.color;
      const darkerBorder = darkenColor(color, 0.2);
      return {
        id: s.id,
        title: s.title,
        start: s.startDatetime,
        end: s.endDatetime,
        backgroundColor: color,
        borderColor: darkerBorder,
        textColor: '#ffffff',
        classNames: ['fc-schedule-event'],
        extendedProps: { schedule: s },
      };
    });
  }, [schedules, scheduleTypes, hiddenTypes]);


  const holidayInteractiveEvents = useMemo(() => {
    const holidays = branchHolidays?.data ?? [];
    return holidays.map((holiday) => {
      const dateStr = holiday.date.slice(0,10);
      return {
        id: `holiday-${holiday.id}`,
        title: holiday.name,
        start: dateStr,
        end: dateStr,
        allDay: true,
        backgroundColor: '#ffffff',
        borderColor: '#ddd',
        textColor: '#111',
        extendedProps: { isHoliday: true, holiday },
      };
    });
  }, [branchHolidays]);

  const holidayBackgroundEvents = useMemo(() => {
    const holidays = branchHolidays?.data ?? [];
    function addOneDay(dateIso: string) {
      const [year, month, day] = dateIso.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + 1);
      const nextYear = date.getFullYear();
      const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
      const nextDay = String(date.getDate()).padStart(2, '0');
      return `${nextYear}-${nextMonth}-${nextDay}`;
    }

    return holidays.map((holiday) => {
      const dateStr = toLocalDateOnly(holiday.date);
      return {
        id: `holiday-bg-${holiday.id}`,
        title: holiday.name,
        start: dateStr,
        end: addOneDay(dateStr),
        allDay: true,
        display: 'background' as const,
        backgroundColor: '#f3f4f6',
        textColor: '#111',
        extendedProps: { isHolidayBackground: true, holiday },
      };
    });
  }, [branchHolidays]);

    return (
    <div ref={calendarContainerRef} className="fc-google-like">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView={navStateInitialView || activeView || 'dayGridMonth'}
        initialDate={navStateInitialDate ? new Date(navStateInitialDate) : undefined}
        locale={esLocale}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' }}
        events={[...scheduleEvents, ...holidayInteractiveEvents, ...holidayBackgroundEvents]}
        selectable={canEdit}
        select={onDateSelect}
        eventClick={onEventClick}
        eventDidMount={(info: EventMountArg) => {
          const el = info.el as HTMLElement | null;
          const ext = info.event.extendedProps as { schedule?: { id?: string } } | undefined;
          const scheduleId = ext?.schedule?.id ?? info.event.id;
          if (el && scheduleId) {
            el.setAttribute('data-schedule-id', String(scheduleId));
            if (onEventMount) onEventMount(String(scheduleId), el);
          }
        }}
        dayMaxEvents={3}
        dayMaxEventRows={3}
        eventContent={(info) => <EventContent info={info} />}
        datesSet={onDatesSet}
        height="auto"
        expandRows
      />
    </div>
  );
}

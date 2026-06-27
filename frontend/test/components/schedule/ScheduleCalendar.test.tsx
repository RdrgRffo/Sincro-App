import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar';
import type { BranchHoliday, Schedule, ScheduleType } from '@/types';

vi.mock('@fullcalendar/react', () => ({
  default: (props: { events?: unknown[] }) => (
    <div data-testid="mock-calendar" data-events={JSON.stringify(props.events ?? [])} />
  ),
}));

vi.mock('@/components/schedule/CalendarEventContent', () => ({
  EventContent: () => null,
}));

describe('ScheduleCalendar', () => {
  it('combina turnos y festivos interactivos/background en eventos del calendario', () => {
    const calendarRef = createRef<unknown>();

    const schedule: Schedule = {
      id: 's-1',
      title: 'Turno Test',
      description: undefined,
      startDatetime: '2026-04-20T08:00:00Z',
      endDatetime: '2026-04-20T16:00:00Z',
      type: 'guardia',
      scheduleTypeId: 'st-1',
      color: '#123456',
      isLastMinute: false,
      createdById: 'system',
      createdBy: { id: 'system', name: 'Sistema' },
      createdAt: '2026-04-20T08:00:00Z',
      updatedAt: '2026-04-20T16:00:00Z',
      assignments: [],
    };

    const holiday: BranchHoliday = {
      id: 'h-1',
      branchId: 'b-1',
      date: '2026-04-20T00:00:00Z',
      name: 'Festivo Test',
      type: 'local',
      scope: 'local',
      isPartial: false,
      isActive: true,
      createdAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      branch: { id: 'b-1', name: 'Madrid', code: 'MAD01' },
    };

    const scheduleType: ScheduleType = { value: 'guardia', label: 'Guardia', color: '#123456', id: 'st-1' };

    render(
      <ScheduleCalendar
        schedules={[schedule]}
        branchHolidays={{ data: [holiday] }}
        scheduleTypes={[scheduleType]}
        canEdit={true}
        activeView="dayGridMonth"
        navStateInitialView="dayGridMonth"
        navStateInitialDate="2026-04-20"
        onDateSelect={vi.fn()}
        onEventClick={vi.fn()}
        onDatesSet={vi.fn()}
        calendarRef={calendarRef}
      />,
    );

    const calendar = screen.getByTestId('mock-calendar');
    const events = JSON.parse(calendar.getAttribute('data-events') || '[]') as Array<{ extendedProps?: { isHoliday?: boolean; isHolidayBackground?: boolean; schedule?: unknown }; title?: string }>;

    expect(events).toHaveLength(3);
    expect(events.some((event) => event.extendedProps?.schedule)).toBe(true);
    expect(events.some((event) => event.extendedProps?.isHoliday)).toBe(true);
    expect(events.some((event) => event.extendedProps?.isHolidayBackground)).toBe(true);
  });
});

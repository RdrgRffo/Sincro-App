import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarDetailPopover, type CalendarDetailItem } from '@/components/schedule/CalendarDetailPopover';
import type { Schedule } from '@/types';

const queryClient = new QueryClient();

function buildSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 's-1',
    title: 'Guardia Central',
    startDatetime: '2026-04-22T08:00:00.000Z',
    endDatetime: '2026-04-22T16:00:00.000Z',
    type: 'guardia',
    color: '#2563eb',
    isLastMinute: false,
    createdById: 'u-admin',
    createdBy: { id: 'u-admin', name: 'Admin' },
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T08:00:00.000Z',
    assignments: [
      {
        scheduleId: 's-1',
        userId: 'u-1',
        assignedAt: '2026-04-20T08:00:00.000Z',
        user: {
          id: 'u-1',
          name: 'Ana Lopez',
          email: 'ana@example.com',
        },
      },
    ],
    ...overrides,
  };
}

describe('CalendarDetailPopover', () => {
  it('renderiza acciones de editar/eliminar para turnos cuando hay permiso', () => {
    const item: CalendarDetailItem = {
      kind: 'schedule',
      schedule: buildSchedule(),
      branchName: 'Sucursal Norte',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <CalendarDetailPopover
          open
          item={item}
          anchor={{ x: 120, y: 80 }}
          canEditSchedule={true}
          canEditHoliday={false}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Guardia Central')).toBeInTheDocument();
    expect(screen.getByTitle('Editar')).toBeInTheDocument();
    expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument();
  });

  it('oculta editar/eliminar para festivos sin permiso de admin', () => {
    const item: CalendarDetailItem = {
      kind: 'holiday',
      holiday: {
        id: 'h-1',
        branchId: 'b-1',
        date: '2026-03-29T00:00:00.000Z',
        name: 'Domingo de Ramos',
        type: 'regional',
        scope: 'regional',
        isPartial: false,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      branchName: 'Sucursal Centro',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <CalendarDetailPopover
          open
          item={item}
          anchor={{ x: 80, y: 90 }}
          canEditSchedule={true}
          canEditHoliday={false}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Domingo de Ramos')).toBeInTheDocument();
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
    expect(screen.getByTitle('Cerrar')).toBeInTheDocument();
  });

  it('ejecuta callbacks al pulsar acciones y al cerrar con Escape', () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAssigneeClick = vi.fn();
    const item: CalendarDetailItem = {
      kind: 'schedule',
      schedule: buildSchedule(),
    };

    render(
      <QueryClientProvider client={queryClient}>
        <CalendarDetailPopover
          open
          item={item}
          anchor={{ x: 40, y: 60 }}
          canEditSchedule={true}
          canEditHoliday={false}
          onClose={onClose}
          onEdit={onEdit}
          onDelete={onDelete}
          onAssigneeClick={onAssigneeClick}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTitle('Editar'));
    fireEvent.click(screen.getByTitle('Eliminar'));
    fireEvent.click(screen.getByRole('button', { name: 'Ana Lopez' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onAssigneeClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

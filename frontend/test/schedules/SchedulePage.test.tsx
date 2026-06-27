import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SchedulePage } from '@/pages/SchedulePage';

const getMock = vi.fn();

const authState: {
  user: {
    id: string;
    role: { name: 'admin' | 'general_manager' | 'department_manager' | 'employee' };
    branchId?: string;
    visibleBranches?: Array<{ branch: { id: string; name: string; code: string; isActive: boolean } }>;
  } | null;
} = {
  user: { id: 'admin-1', role: { name: 'admin' } },
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: (selector: (state: { sidebarCollapsed: boolean; scheduleSidebarOpen: boolean }) => unknown) =>
    selector({
      sidebarCollapsed: false,
      scheduleSidebarOpen: true,
    }),
}));

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@fullcalendar/react', () => ({
  default: (props: { events?: unknown[] }) => (
    <div data-testid="mock-calendar" data-events={JSON.stringify(props.events ?? [])} />
  ),
}));

vi.mock('@/components/schedule/ShiftModal', () => ({
  ShiftModal: () => null,
}));

vi.mock('@/components/schedule/CalendarDetailPopover', () => ({
  CalendarDetailPopover: () => null,
}));

vi.mock('@/components/schedule/HolidayEditModal', () => ({
  HolidayEditModal: () => null,
}));

vi.mock('@/components/common/UserProfileModal', () => ({
  UserProfileModal: () => null,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={['/schedule']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/schedule" element={<SchedulePage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function getScheduleCall() {
  return getMock.mock.calls.find((call) => call[0] === '/schedules');
}

describe('SchedulePage smoke', () => {
  type CalendarEvent = {
    id?: string;
    title?: string;
    extendedProps?: {
      isHoliday?: boolean;
      schedule?: unknown;
    };
  };

  beforeEach(() => {
    getMock.mockReset();
  });

  it('admin carga calendario sin branchId forzado cuando no hay sucursal activa', async () => {
    authState.user = { id: 'admin-1', role: { name: 'admin' } };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'b-1',
                name: 'Madrid',
                code: 'MAD01',
                countryCode: 'ES',
                timezone: 'Europe/Madrid',
                isActive: true,
                createdAt: '',
                updatedAt: '',
              },
            ],
          },
        });
      }

      if (url === '/schedules') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }

      if (url === '/branches/all/holidays' || url === '/branches/b-1/holidays') {
        return Promise.resolve({ 
          data: { 
            success: true, 
            data: [
              { 
                id: 'h-1', 
                name: 'Festivo Test', 
                date: '2026-04-20T00:00:00Z', 
                type: 'local',
                isPartial: false,
                branch: { id: 'b-1', name: 'Madrid', code: 'MAD01' }
              } 
            ] 
          } 
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        '/branches/all/holidays',
        expect.objectContaining({
          params: expect.objectContaining({ groupShared: true }),
        }),
      );
    });
  });

  it('employee con sucursal asignada usa su branchId', async () => {
    authState.user = { id: 'employee-1', role: { name: 'employee' }, branchId: 'b-1' };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'b-1',
                name: 'Madrid',
                code: 'MAD01',
                countryCode: 'ES',
                timezone: 'Europe/Madrid',
                isActive: true,
                createdAt: '',
                updatedAt: '',
              },
            ],
          },
        });
      }

      if (url === '/schedules') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }

      if (url === '/branches/b-1/holidays') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const scheduleCall = getScheduleCall();
      expect(scheduleCall).toBeTruthy();
      expect(scheduleCall?.[1]).toEqual(expect.objectContaining({ params: expect.objectContaining({ branchId: 'b-1' }) }));
    });

    expect(getMock).toHaveBeenCalledWith(
      '/branches/b-1/holidays',
      expect.any(Object),
    );
  });

  it('no-admin con múltiples sucursales visibles puede cambiar sucursal sin opción global', async () => {
    authState.user = {
      id: 'manager-1',
      role: { name: 'general_manager' },
      branchId: 'b-1',
      visibleBranches: [{ branch: { id: 'b-2', name: 'Barcelona', code: 'BCN02', isActive: true } }],
    };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 'b-1', name: 'Madrid', code: 'MAD01', countryCode: 'ES', timezone: 'Europe/Madrid', isActive: true, createdAt: '', updatedAt: '' },
              { id: 'b-2', name: 'Barcelona', code: 'BCN02', countryCode: 'ES', timezone: 'Europe/Madrid', isActive: true, createdAt: '', updatedAt: '' },
            ],
          },
        });
      }
      if (url === '/departments') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/schedules') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/branches/b-1/holidays' || url === '/branches/b-2/holidays') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        '/schedules',
        expect.objectContaining({
          params: expect.objectContaining({ branchId: 'b-1' }),
        }),
      );
    });

    expect(screen.queryByText('Todas las sucursales')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Barcelona' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        '/schedules',
        expect.objectContaining({
          params: expect.objectContaining({ branchId: 'b-2' }),
        }),
      );
    });
  });

  it('employee sin sucursal asignada y sin sucursales no consulta schedules', async () => {
    authState.user = { id: 'employee-2', role: { name: 'employee' } };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/branches', { params: { includeInactive: true } });
    });

    // Sin sucursales disponibles y sin branch asignada, no se consultan schedules ni holidays
    expect(getMock.mock.calls.some((call) => call[0] === '/schedules')).toBe(false);
    expect(getMock.mock.calls.some((call) => call[0] === '/branches/all/holidays')).toBe(false);
  });
  
  it('combina turnos y festivos en el calendario', async () => {
    authState.user = { id: 'employee-1', role: { name: 'employee' }, branchId: 'b-1' };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 'b-1', name: 'Madrid', code: 'MAD01', isActive: true }],
          },
        });
      }
      if (url === '/schedules') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 's-1', title: 'Turno Test', type: 'guardia', startDatetime: '2026-04-20T08:00:00Z', endDatetime: '2026-04-20T16:00:00Z' }],
          },
        });
      }
      if (url === '/branches/b-1/holidays' || url === '/branches/all/holidays') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ 
              id: 'h-1', 
              name: 'Festivo Test', 
              date: '2026-04-20T00:00:00Z', 
              type: 'local',
              isPartial: false,
              branch: { id: 'b-1', name: 'Madrid', code: 'MAD01' }
            }],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const calendar = screen.getByTestId('mock-calendar');
      const events = JSON.parse(calendar.getAttribute('data-events') || '[]') as CalendarEvent[];
      
      // Debe haber 3 eventos: 1 turno + 1 festivo interactivo + 1 festivo background
      expect(events).toHaveLength(3);
      
      const holiday = events.find((e) => e.extendedProps?.isHoliday);
      expect(holiday?.title).toBeDefined();
      
      const schedule = events.find((e) => e.extendedProps?.schedule);
      expect(schedule?.title).toBe('Turno Test');
    });
  });

  it('agrupa festivos compartidos en vista general y evita duplicados', async () => {
    authState.user = { id: 'admin-1', role: { name: 'admin' } };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === '/branches/all/holidays') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { 
                id: 'shared-2026-01-01-ano-nuevo',
                branchId: 'all',
                name: 'Año Nuevo',
                date: '2026-01-01T00:00:00Z',
                type: 'nacional',
                scope: 'national',
                isPartial: false,
                isActive: true,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
                branch: null,
                holidayIds: ['h-1', 'h-2'],
                branches: [
                  { id: 'b-1', name: 'Madrid', code: 'MAD01' },
                  { id: 'b-2', name: 'Barcelona', code: 'BCN02' },
                ],
                sharedCount: 2,
              }
            ],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const calendar = screen.getByTestId('mock-calendar');
      const events = JSON.parse(calendar.getAttribute('data-events') || '[]');

      const holidayEvents = (events as CalendarEvent[]).filter((e) => e.extendedProps?.isHoliday);
      expect(holidayEvents).toHaveLength(1);
      expect(holidayEvents[0].title).toBe('Año Nuevo');
    });
  });
});

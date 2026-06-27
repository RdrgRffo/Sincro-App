/**
 * @file DashboardPage.test.tsx
 * Tests de la página Dashboard: renderizado condicional por rol, stats, widgets.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const getMock = vi.fn();

const authState: {
  user: { id: string; name: string; role: { name: 'admin' | 'general_manager' | 'department_manager' | 'employee' }; branchId?: string } | null;
} = {
  user: { id: 'admin-1', name: 'Admin User', role: { name: 'admin' } },
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/store/uiStore', () => ({
  useUIStore: (selector: (state: { sidebarCollapsed: boolean }) => unknown) =>
    selector({
      sidebarCollapsed: false,
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

vi.mock('@/components/common/StatCard', () => ({
  StatCard: ({ title, value }: { title: string; value: string | number }) => (
    <div data-testid="stat-card" data-title={title} data-value={value}>
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('@/components/common/UserProfileModal', () => ({
  UserProfileModal: () => null,
}));

vi.mock('@/components/schedule/WeekSchedulesWidget', () => ({
  WeekSchedulesWidget: () => <div data-testid="week-schedules-widget">Turnos semanales</div>,
}));

vi.mock('@/components/schedule/MyWeeklySummaryCard', () => ({
  MyWeeklySummaryCard: () => <div data-testid="my-weekly-summary">Mi resumen semanal</div>,
}));

vi.mock('@/components/schedule/TeamWeeklySummaryCard', () => ({
  TeamWeeklySummaryCard: () => <div data-testid="team-weekly-summary">Resumen del equipo</div>,
}));

vi.mock('@/components/audit/RecentActivityWidget', () => ({
  RecentActivityWidget: () => <div data-testid="recent-activity">Actividad reciente</div>,
}));

import { DashboardPage } from '@/pages/DashboardPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset authState to default admin
    authState.user = { id: 'admin-1', name: 'Admin User', role: { name: 'admin' } };
  });

  it('muestra el saludo con el nombre del usuario', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Bienvenido/)).toBeInTheDocument();
      expect(screen.getByText(/Admin/)).toBeInTheDocument();
    });
  });

  it('muestra stat cards para admin', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const statCards = screen.getAllByTestId('stat-card');
      expect(statCards.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('muestra el widget de turnos semanales', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('week-schedules-widget')).toBeInTheDocument();
    });
  });

  it('muestra el resumen semanal personal', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('my-weekly-summary')).toBeInTheDocument();
    });
  });

  it('muestra resumen del equipo para admin', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('team-weekly-summary')).toBeInTheDocument();
    });
  });

  it('muestra actividad reciente solo para admin', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
    });
  });

  it('no muestra actividad reciente para employee', async () => {
    authState.user = { id: 'emp-1', name: 'Employee', role: { name: 'employee' } };

    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('recent-activity')).not.toBeInTheDocument();
    });
  });

  it('no muestra resumen del equipo para employee', async () => {
    authState.user = { id: 'emp-1', name: 'Employee', role: { name: 'employee' } };

    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('team-weekly-summary')).not.toBeInTheDocument();
    });
  });

  it('no muestra usuarios activos para employee', async () => {
    authState.user = { id: 'emp-1', name: 'Employee', role: { name: 'employee' } };

    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      // Should only have 3 stat cards (turnos, mis turnos, cambios urgentes) - not usuarios activos
      const statCards = screen.getAllByTestId('stat-card');
      const userStat = statCards.find((card) => card.getAttribute('data-title') === 'Usuarios activos');
      expect(userStat).toBeUndefined();
    });
  });

  it('llama a /schedules/week al cargar', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const weekCall = getMock.mock.calls.find((call: unknown[]) => (call[0] as string).includes('/schedules/week'));
      expect(weekCall).toBeDefined();
    });
  });

  /* ─── Edge cases ─────────────────────────────────────────────── */

  it('muestra general_manager puede ver usuarios activos y resumen equipo', async () => {
    authState.user = { id: 'gm-1', name: 'GM User', role: { name: 'general_manager' }, branchId: 'b-1' };

    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 10 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('team-weekly-summary')).toBeInTheDocument();
      // Should have usuarios activos stat card
      const statCards = screen.getAllByTestId('stat-card');
      const userStat = statCards.find((card) => card.getAttribute('data-title') === 'Usuarios activos');
      expect(userStat).toBeDefined();
    });
  });

  it('no muestra actividad reciente para general_manager', async () => {
    authState.user = { id: 'gm-1', name: 'GM User', role: { name: 'general_manager' }, branchId: 'b-1' };

    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 10 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('recent-activity')).not.toBeInTheDocument();
    });
  });

  it('muestra department_manager puede ver usuarios activos y resumen equipo', async () => {
    authState.user = { id: 'dm-1', name: 'DM User', role: { name: 'department_manager' }, branchId: 'b-1' };

    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 3 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('team-weekly-summary')).toBeInTheDocument();
      const statCards = screen.getAllByTestId('stat-card');
      const userStat = statCards.find((card) => card.getAttribute('data-title') === 'Usuarios activos');
      expect(userStat).toBeDefined();
    });
  });

  it('muestra mis turnos count cuando el usuario tiene asignaciones', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({
          data: {
            data: {
              items: [
                {
                  id: 's-1',
                  title: 'Guardia A',
                  startDatetime: '2026-05-07T08:00:00Z',
                  endDatetime: '2026-05-07T15:00:00Z',
                  isLastMinute: false,
                  assignees: [{ id: 'admin-1', name: 'Admin User' }],
                },
                {
                  id: 's-2',
                  title: 'Guardia B',
                  startDatetime: '2026-05-08T08:00:00Z',
                  endDatetime: '2026-05-08T15:00:00Z',
                  isLastMinute: true,
                  assignees: [{ id: 'admin-1', name: 'Admin User' }],
                },
              ],
            },
          },
        });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      // Should have "Mis turnos" with value 2
      const statCards = screen.getAllByTestId('stat-card');
      const myShiftsStat = statCards.find((card) => card.getAttribute('data-title') === 'Mis turnos');
      expect(myShiftsStat).toBeDefined();
      expect(myShiftsStat?.getAttribute('data-value')).toBe('2');
    });
  });

  it('muestra alertas count', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes('/schedules/week')) {
        return Promise.resolve({
          data: {
            data: {
              items: [
                {
                  id: 's-1',
                  title: 'Guardia A',
                  startDatetime: '2026-05-07T08:00:00Z',
                  endDatetime: '2026-05-07T15:00:00Z',
                  isLastMinute: true,
                  assignees: [{ id: 'other-1', name: 'Other User' }],
                },
                {
                  id: 's-2',
                  title: 'Guardia B',
                  startDatetime: '2026-05-08T08:00:00Z',
                  endDatetime: '2026-05-08T15:00:00Z',
                  isLastMinute: true,
                  assignees: [{ id: 'other-2', name: 'Other User 2' }],
                },
              ],
            },
          },
        });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: { pagination: { total: 5 } } });
      }
      if (url.includes('/schedules/alerts')) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const statCards = screen.getAllByTestId('stat-card');
      const alertStat = statCards.find((card) => card.getAttribute('data-title') === 'Alertas');
      expect(alertStat).toBeDefined();
      expect(alertStat?.getAttribute('data-value')).toBe('2');
    });
  });

  it('maneja error de API sin romper', async () => {
    getMock.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      // Should still render the welcome message without crashing
      expect(screen.getByText(/Bienvenido/)).toBeInTheDocument();
    });
  });
});

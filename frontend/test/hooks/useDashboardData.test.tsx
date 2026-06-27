import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { User } from '@/types';

const getMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aplica filtros por rol al cargar la semana y calcula métricas derivadas', async () => {
    const user: User = {
      id: 'u-1',
      name: 'Gerente General',
      email: 'gm@test.dev',
      role: { name: 'general_manager' },
      branchId: 'b-1',
      status: 'active',
      createdAt: '2026-05-27T00:00:00.000Z',
    };

    getMock.mockImplementation((url: string) => {
      if (url.startsWith('/schedules/week/')) {
        return Promise.resolve({
          data: {
            data: {
              items: [
                { id: 's-1', isLastMinute: true, assignees: [{ id: 'u-1' }] },
                { id: 's-2', isLastMinute: false, assignees: [{ id: 'u-2' }] },
              ],
            },
          },
        });
      }

      if (url === '/users?limit=1&status=active') {
        return Promise.resolve({ data: { pagination: { total: 9 } } });
      }

      if (url === '/schedules/alerts') {
        return Promise.resolve({ data: { data: [{ type: 'solo', scheduleId: 's-1', title: 'Alerta', date: '2026-05-27' }] } });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    const { result } = renderHook(() => useDashboardData(user), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loadingSchedules).toBe(false));

    expect(getMock).toHaveBeenCalledWith(expect.stringContaining('/schedules/week/'));
    expect(getMock).toHaveBeenCalledWith('/users?limit=1&status=active');
    expect(getMock).toHaveBeenCalledWith('/schedules/alerts');
    expect(result.current.mySchedules).toHaveLength(1);
    expect(result.current.lastMinuteCount).toBe(1);
    expect(result.current.usersData).toBe(9);
    expect(result.current.totalAlerts).toBe(1);
  });

  it('no consulta usuarios activos para employee', async () => {
    getMock.mockImplementation((url: string) => {
      if (url.startsWith('/schedules/week/')) {
        return Promise.resolve({ data: { data: { items: [] } } });
      }

      if (url === '/schedules/alerts') {
        return Promise.resolve({ data: { data: [] } });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    const { result } = renderHook(
      () => useDashboardData({ id: 'emp-1', name: 'Emp', email: 'emp@test.dev', role: { name: 'employee' }, status: 'active', createdAt: '2026-05-27T00:00:00.000Z' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.loadingSchedules).toBe(false));

    expect(getMock.mock.calls.some((call) => call[0] === '/users?limit=1&status=active')).toBe(false);
    expect(result.current.usersData).toBeUndefined();
  });
});

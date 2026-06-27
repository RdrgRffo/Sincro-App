import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScheduleData } from '@/hooks/useScheduleData';
import type { ReactNode } from 'react';

const getMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useScheduleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga branches, departments, schedules y holidays para admin en vista mensual', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            data: [
              { id: 'b-1', name: 'Madrid', code: 'MAD01', timezone: 'Europe/Madrid' },
            ],
          },
        });
      }

      if (url === '/departments') {
        return Promise.resolve({
          data: {
            data: [
              { id: 'd-1', name: 'Cocina', code: 'COC' },
            ],
          },
        });
      }

      if (url === '/schedules') {
        return Promise.resolve({ data: { data: [] } });
      }

      if (url === '/branches/all/holidays') {
        return Promise.resolve({ data: { data: [] } });
      }

      return Promise.resolve({ data: { data: null } });
    });

    const { result } = renderHook(
      () =>
        useScheduleData({
          user: { id: 'admin-1', role: { name: 'admin' } },
          activeBranchId: '',
          selectedDeptId: '',
          filterUserId: '',
          shouldUseWeekEndpoint: false,
          weekRefDate: new Date('2026-04-01T00:00:00.000Z'),
          dateRange: {
            from: new Date('2026-04-01T00:00:00.000Z'),
            to: new Date('2026-04-30T00:00:00.000Z'),
          },
          scheduleId: undefined,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.availableBranches).toHaveLength(1));
    await waitFor(() => expect(result.current.departmentList).toHaveLength(1));

    expect(getMock).toHaveBeenCalledWith('/branches', { params: { includeInactive: true } });
    expect(getMock).toHaveBeenCalledWith('/departments', { params: { includeInactive: false, branchId: undefined } });
    expect(getMock).toHaveBeenCalledWith(
      '/schedules',
      expect.objectContaining({
        params: expect.objectContaining({
          from: expect.any(String),
          to: expect.any(String),
        }),
      }),
    );
    expect(getMock).toHaveBeenCalledWith('/branches/all/holidays', { params: { from: expect.any(String), to: expect.any(String), groupShared: true } });
  });

  it('resuelve filterUserId=me y evita consultar schedules si no hay sucursal seleccionable', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({ data: { data: [] } });
      }

      if (url === '/departments') {
        return Promise.resolve({ data: { data: [] } });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    const { result } = renderHook(
      () =>
        useScheduleData({
          user: { id: 'u-1', role: { name: 'employee' } },
          activeBranchId: '',
          selectedDeptId: '',
          filterUserId: 'me',
          shouldUseWeekEndpoint: false,
          weekRefDate: new Date('2026-04-01T00:00:00.000Z'),
          dateRange: {
            from: new Date('2026-04-01T00:00:00.000Z'),
            to: new Date('2026-04-30T00:00:00.000Z'),
          },
          scheduleId: undefined,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.availableBranches).toHaveLength(0));
    expect(result.current.resolvedFilterUserId).toBe('u-1');
    expect(result.current.schedules).toBeNull();
    expect(getMock.mock.calls.some((call) => call[0] === '/schedules')).toBe(false);
    expect(getMock.mock.calls.some((call) => call[0] === '/branches/all/holidays')).toBe(false);
  });
});

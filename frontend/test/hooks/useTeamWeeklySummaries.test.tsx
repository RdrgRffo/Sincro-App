/**
 * @file useTeamWeeklySummaries.test.ts
 * Tests del hook de resúmenes semanales de equipo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamWeeklySummaries } from '@/hooks/useTeamWeeklySummaries';
import type { ReactNode } from 'react';

const getMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

const mockTeamSummaries = [
  { userId: 'u1', userName: 'Juan', totalHours: 40, baseHours: 35, overtimeHours: 5, dailyBreakdown: {} },
  { userId: 'u2', userName: 'María', totalHours: 38, baseHours: 35, overtimeHours: 3, dailyBreakdown: {} },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTeamWeeklySummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene resúmenes sin filtros', async () => {
    getMock.mockResolvedValue({ data: { data: mockTeamSummaries } });

    const { result } = renderHook(() => useTeamWeeklySummaries(2026, 19), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/schedules/team-weekly-summary/2026/19');
    expect(result.current.data).toHaveLength(2);
  });

  it('obtiene resúmenes con filtro de sucursal', async () => {
    getMock.mockResolvedValue({ data: { data: mockTeamSummaries } });

    const { result } = renderHook(() => useTeamWeeklySummaries(2026, 19, { branchId: 'b-1' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/schedules/team-weekly-summary/2026/19?branchId=b-1');
  });

  it('obtiene resúmenes con filtro de departamento', async () => {
    getMock.mockResolvedValue({ data: { data: mockTeamSummaries } });

    const { result } = renderHook(() => useTeamWeeklySummaries(2026, 19, { departmentId: 'd-1' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/schedules/team-weekly-summary/2026/19?departmentId=d-1');
  });

  it('maneja error de API', async () => {
    getMock.mockRejectedValue(new Error('Error'));

    const { result } = renderHook(() => useTeamWeeklySummaries(2026, 19), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

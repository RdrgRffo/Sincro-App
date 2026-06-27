/**
 * @file useMyWeeklySummary.test.ts
 * Tests del hook de resumen semanal del usuario autenticado.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyWeeklySummary } from '@/hooks/useMyWeeklySummary';
import type { ReactNode } from 'react';

const getMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

const mockSummary = {
  userId: 'u1',
  year: 2026,
  week: 19,
  totalHours: 40,
  baseHours: 35,
  overtimeHours: 5,
  dailyBreakdown: { '2026-05-11': 8, '2026-05-12': 8 },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMyWeeklySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene el resumen semanal del usuario', async () => {
    getMock.mockResolvedValue({ data: { data: mockSummary } });

    const { result } = renderHook(() => useMyWeeklySummary(2026, 19), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/schedules/my-weekly-summary/2026/19');
    expect(result.current.data).toEqual(mockSummary);
  });

  it('maneja error de API', async () => {
    getMock.mockRejectedValue(new Error('Error'));

    const { result } = renderHook(() => useMyWeeklySummary(2026, 19), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

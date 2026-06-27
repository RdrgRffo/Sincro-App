/**
 * @file useScheduleTypes.test.ts
 * Tests del hook de tipos de turno.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScheduleTypes } from '@/hooks/useScheduleTypes';
import type { ReactNode } from 'react';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn() };
  return { default: toast, toast };
});

const mockTypes = [
  { id: '1', label: 'Mañana', value: 'manana', color: '#4F46E5', createdAt: '', updatedAt: '' },
  { id: '2', label: 'Tarde', value: 'tarde', color: '#F59E0B', createdAt: '', updatedAt: '' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useScheduleTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene la lista de tipos de turno', async () => {
    getMock.mockResolvedValue({ data: { success: true, data: mockTypes } });

    const { result } = renderHook(() => useScheduleTypes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.types).toHaveLength(2);
    expect(result.current.types[0].label).toBe('Mañana');
  });

  it('retorna array vacío cuando no hay datos', async () => {
    getMock.mockResolvedValue({ data: { success: true, data: null } });

    const { result } = renderHook(() => useScheduleTypes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.types).toEqual([]);
  });
});

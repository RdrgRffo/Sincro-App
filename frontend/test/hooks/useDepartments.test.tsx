import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';
import type { ReactNode } from 'react';

const getMock = vi.fn();
vi.mock('@/config/api', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDepartments', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('llama a /departments con branchId cuando se pasa', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useDepartments('branch123'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/departments', { params: { includeInactive: false, branchId: 'branch123' } });
  });

  it('no añade branchId cuando es undefined', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useDepartments(undefined), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/departments', { params: { includeInactive: false, branchId: undefined } });
  });
});

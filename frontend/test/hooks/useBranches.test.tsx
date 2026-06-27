import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBranches } from '@/hooks/useBranches';
import type { ReactNode } from 'react';

const getMock = vi.fn();
vi.mock('@/config/api', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBranches', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('llama a /branches sin params por defecto', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useBranches(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/branches', { params: { includeInactive: false } });
  });

  it('acepta includeInactive=true', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useBranches(true), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/branches', { params: { includeInactive: true } });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBranchesHolidays } from '@/hooks/useBranchesHolidays';
import type { ReactNode } from 'react';

const getMock = vi.fn();
vi.mock('@/config/api', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

function createWrapper() { const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={qc}>{children}</QueryClientProvider>; }; }

describe('useBranchesHolidays', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('llama a /branches/:id/holidays con rango', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useBranchesHolidays('branch1', '2026-06-01', '2026-06-30'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/branches/branch1/holidays', { params: { from: '2026-06-01', to: '2026-06-30' } });
  });
});

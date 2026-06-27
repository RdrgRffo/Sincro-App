import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import type { ReactNode } from 'react';

const getMock = vi.fn();
vi.mock('@/config/api', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

function createWrapper() { const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={qc}>{children}</QueryClientProvider>; }; }

describe('useNotificationLogs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('llama a /notifications/logs con page param', async () => {
    getMock.mockResolvedValue({ data: { data: [], pagination: { totalPages: 1 } } });
    const { result } = renderHook(() => useNotificationLogs(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/notifications/logs', { params: { page: 1, limit: 20 } });
  });
});

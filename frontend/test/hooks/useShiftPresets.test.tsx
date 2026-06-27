import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShiftPresets } from '@/hooks/useShiftPresets';
import type { ReactNode } from 'react';

const getMock = vi.fn();
vi.mock('@/config/api', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

function createWrapper() { const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={qc}>{children}</QueryClientProvider>; }; }

describe('useShiftPresets', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('llama a /shift-presets', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useShiftPresets(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMock).toHaveBeenCalledWith('/shift-presets');
  });
});

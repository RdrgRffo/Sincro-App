/**
 * @file useAbsences.test.tsx
 * Tests del hook de ausencias.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAbsencesList,
  useAbsenceCalendar,
  useAbsenceById,
  useCreateAbsence,
  useApproveAbsence,
  useRejectAbsence,
  useCancelAbsence,
} from '@/hooks/useAbsences';
import type { ReactNode } from 'react';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

const mockAbsences = {
  items: [
    { id: 'v1', employeeId: 'u1', startDate: '2026-06-01', endDate: '2026-06-10', status: 'pending' },
    { id: 'v2', employeeId: 'u2', startDate: '2026-07-01', endDate: '2026-07-05', status: 'approved' },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAbsencesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene lista paginada de ausencias', async () => {
    getMock.mockResolvedValue({ data: { data: mockAbsences } });

    const { result } = renderHook(() => useAbsencesList({ page: 1, pageSize: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/absences', { params: { page: 1, pageSize: 20 } });
    expect(result.current.data?.items).toHaveLength(2);
  });

  it('filtra por estado', async () => {
    getMock.mockResolvedValue({ data: { data: mockAbsences } });

    const { result } = renderHook(() => useAbsencesList({ status: 'pending' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/absences', { params: { status: 'pending' } });
  });
});

describe('useAbsenceCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene calendario de ausencias', async () => {
    getMock.mockResolvedValue({ data: { data: { items: [] } } });

    const { result } = renderHook(() => useAbsenceCalendar(2026, 19, {}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/absences/calendar', { params: { year: 2026, week: 19 } });
  });

  it('no ejecuta query cuando disabled', () => {
    renderHook(() => useAbsenceCalendar(2026, 19, {}, false), {
      wrapper: createWrapper(),
    });

    expect(getMock).not.toHaveBeenCalled();
  });
});

describe('useAbsenceById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene detalle de ausencia por ID', async () => {
    getMock.mockResolvedValue({ data: { data: { id: 'v1', status: 'pending' } } });

    const { result } = renderHook(() => useAbsenceById('v1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMock).toHaveBeenCalledWith('/absences/v1');
  });

  it('no ejecuta query cuando id es undefined', () => {
    renderHook(() => useAbsenceById(undefined), {
      wrapper: createWrapper(),
    });

    expect(getMock).not.toHaveBeenCalled();
  });
});

describe('useCreateAbsence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea una solicitud de ausencia', async () => {
    postMock.mockResolvedValue({ data: { data: { id: 'v3', hasOverlap: false, overlappingEmployees: [] } } });

    const { result } = renderHook(() => useCreateAbsence(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ startDate: '2026-08-01', endDate: '2026-08-10', type: 'vacaciones' });

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(postMock).toHaveBeenCalledWith('/absences', {
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      type: 'vacaciones',
    });
  });
});

describe('useApproveAbsence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aprueba una solicitud de ausencia', async () => {
    patchMock.mockResolvedValue({ data: { data: { id: 'v1', status: 'approved' } } });

    const { result } = renderHook(() => useApproveAbsence(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'v1' });

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(patchMock).toHaveBeenCalledWith('/absences/v1/approve', { note: undefined });
  });
});

describe('useRejectAbsence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza una solicitud de ausencia', async () => {
    patchMock.mockResolvedValue({ data: { data: { id: 'v1', status: 'rejected' } } });

    const { result } = renderHook(() => useRejectAbsence(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'v1', rejectionReason: 'No disponible' });

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(patchMock).toHaveBeenCalledWith('/absences/v1/reject', { rejectionReason: 'No disponible' });
  });
});

describe('useCancelAbsence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancela una solicitud de ausencia', async () => {
    deleteMock.mockResolvedValue({ data: { data: { id: 'v1', status: 'cancelled' } } });

    const { result } = renderHook(() => useCancelAbsence(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('v1');

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    expect(deleteMock).toHaveBeenCalledWith('/absences/v1');
  });
});

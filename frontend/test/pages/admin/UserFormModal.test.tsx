/**
 * @file UserFormModal.test.tsx
 * Comportamiento de sucursales visibles y payload según rol (§6.2).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserFormModal } from '@/pages/admin/UserFormModal';
import type { User } from '@/types';

const getMock = vi.fn();
const patchMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const dmActor: User = {
  id: 'actor-dm',
  name: 'DM',
  email: 'dm@test.com',
  role: { name: 'department_manager' },
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  branchId: 'b1',
  departmentId: 'd1',
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { user: User | null }) => User | null) => selector({ user: dmActor }),
}));

const branchB1 = {
  id: 'b1',
  name: 'TFN',
  code: 'TFN',
  isActive: true,
  countryCode: 'ES',
  timezone: 'Atlantic/Canary',
  createdAt: '',
  updatedAt: '',
};
const branchB2 = {
  id: 'b2',
  name: 'GC',
  code: 'GC',
  isActive: true,
  countryCode: 'ES',
  timezone: 'Atlantic/Canary',
  createdAt: '',
  updatedAt: '',
};
const departmentD1 = {
  id: 'd1',
  name: 'Cocina',
  code: 'COC',
  isActive: true,
  createdAt: '',
  updatedAt: '',
  branchIds: ['b1'],
};

const editTarget: User = {
  id: 'u-target',
  employeeId: 'E001',
  name: 'Empleado Uno',
  email: 'emp@test.com',
  role: { name: 'employee' },
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  branchId: 'b1',
  departmentId: 'd1',
  department: { id: 'd1', name: 'Cocina', code: 'COC' },
  branch: { id: 'b1', name: 'TFN', code: 'TFN', isActive: true },
  visibleBranches: [{ branch: branchB2, assignedAt: '2026-01-02T00:00:00Z' }],
  skills: [],
};

function setupGetMocks() {
  getMock.mockImplementation((url: string) => {
    if (url === '/branches') {
      return Promise.resolve({ data: { data: [branchB1, branchB2] } });
    }
    if (url === '/skills') {
      return Promise.resolve({ data: { data: [] } });
    }
    if (url === '/departments') {
      return Promise.resolve({ data: { data: [departmentD1] } });
    }
    if (url.startsWith('/users/')) {
      return Promise.resolve({ data: { data: editTarget } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderModal(props: { user: User | null; roleName?: string }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <UserFormModal open user={props.user} roleName={props.roleName ?? 'department_manager'} onClose={() => {}} />
    </QueryClientProvider>
  );
}

describe('UserFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patchMock.mockResolvedValue({ data: {} });
    setupGetMocks();
  });

  it('como DM muestra sucursales visibles adicionales en solo lectura y no envía visibleBranchIds al guardar', async () => {
    const user = userEvent.setup();
    renderModal({ user: editTarget });

    await waitFor(() => {
      expect(screen.getByText(/GC \(GC\)/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Solo administración o gerencia general pueden modificarlas/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });

    const body = patchMock.mock.calls[0][1] as Record<string, unknown>;
    expect(body.visibleBranchIds).toBeUndefined();
  });
});

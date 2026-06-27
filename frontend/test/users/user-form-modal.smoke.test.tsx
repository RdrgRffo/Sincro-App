import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFormModal } from '@/pages/admin/UserFormModal';
import type { User } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
  },
}));

describe('UserFormModal smoke', () => {
  beforeEach(() => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({ data: { data: [{ id: 'b1', name: 'Norte', code: 'NRT', isActive: true }] } });
      }
      if (url === '/departments') {
        return Promise.resolve({ data: { data: [{ id: 'd1', name: 'Soporte', code: 'SOP' }] } });
      }
      if (url === '/skills') {
        return Promise.resolve({ data: { data: [{ id: 's1', name: 'Soporte L1', color: '#1d4ed8', isActive: true }] } });
      }
      if (url === '/roles') {
        return Promise.resolve({ data: { data: [{ id: 'r1', name: 'employee' }] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('renders skills checklist and visible branches selectors', async () => {
    const queryClient = new QueryClient();

    const employeeUser: User = {
      id: 'u1',
      name: 'Ana',
      email: 'ana@test.com',
      role: { name: 'employee', permissions: [] },
      status: 'active',
      createdAt: new Date().toISOString(),
      branchId: 'b1',
      departmentId: 'd1',
      skills: [
        {
          assignedAt: new Date().toISOString(),
          skill: { id: 's1', name: 'Soporte L1', color: '#1d4ed8', isActive: true },
        },
      ],
      visibleBranches: [
        {
          assignedAt: new Date().toISOString(),
          branch: { id: 'b1', name: 'Norte', code: 'NRT', isActive: true },
        },
      ],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <UserFormModal
          open
          roleName="admin"
          onClose={() => undefined}
          user={employeeUser}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Skills')).toBeInTheDocument();
    expect(await screen.findByText('Sucursales visibles adicionales')).toBeInTheDocument();
    expect(await screen.findByText('Soporte L1')).toBeInTheDocument();
  });
});

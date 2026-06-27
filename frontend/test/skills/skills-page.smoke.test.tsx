import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillsPage } from '@/pages/admin/SkillsPage';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

describe('SkillsPage smoke', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue({
      data: {
        data: [{ id: 's1', name: 'Soporte', category: 'Operación', color: '#1d4ed8', isActive: true }],
      },
    });
    const adminUser: User = {
      id: 'u1',
      name: 'Admin',
      email: 'admin@test.com',
      role: { name: 'admin', permissions: [] },
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    useAuthStore.setState({
      user: adminUser,
      isAuthenticated: true,
    });
  });

  it('renders catalog and create button', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SkillsPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Skills y certificaciones')).toBeInTheDocument();
    expect(await screen.findByText('Catálogo')).toBeInTheDocument();
    expect(await screen.findByText('Soporte')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /nueva skill/i })).toBeInTheDocument();
  });

  it('opens create modal from Nueva skill', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SkillsPage />
      </QueryClientProvider>,
    );

    await screen.findByText('Soporte');
    await userEvent.click(screen.getByRole('button', { name: /nueva skill/i }));
    expect(screen.getByRole('dialog', { name: /nueva skill/i })).toBeInTheDocument();
  });
});

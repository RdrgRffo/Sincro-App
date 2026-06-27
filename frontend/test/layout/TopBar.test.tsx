/**
 * @file TopBar.test.tsx
 * Tests del componente TopBar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';

const mockUser = {
  id: 'u1',
  name: 'Juan Pérez',
  role: { name: 'admin' },
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

const mockUseInApp = {
  unreadCount: 0,
  notifications: [] as const,
  loading: false,
  pagination: { page: 1, total: 0, totalPages: 0 },
  fetchNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  deleteAllNotifications: vi.fn(),
  refreshNotifications: vi.fn(),
};

vi.mock('@/hooks/useInAppNotifications', () => ({
  useInAppNotifications: () => mockUseInApp,
}));

function renderTopBar(title?: string) {
  return render(
    <MemoryRouter>
      <TopBar title={title} />
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza nombre de usuario', () => {
    renderTopBar();

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });

  it('renderiza título cuando se proporciona', () => {
    renderTopBar('Dashboard');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('no renderiza título cuando no se proporciona', () => {
    renderTopBar();

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renderiza el panel de notificaciones', () => {
    renderTopBar();

    expect(screen.getByLabelText('Notificaciones')).toBeInTheDocument();
  });

  it('al abrir el panel, Actualizar invoca refreshNotifications', async () => {
    renderTopBar();

    await userEvent.click(screen.getByLabelText('Notificaciones'));
    await userEvent.click(screen.getByLabelText('Actualizar notificaciones'));

    expect(mockUseInApp.refreshNotifications).toHaveBeenCalledTimes(1);
  });
});

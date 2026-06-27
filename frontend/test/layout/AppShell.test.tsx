import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => <div>TopBar</div>,
}));

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div>MobileNav</div>,
}));

vi.mock('@/components/auth/ForceChangePassword', () => ({
  ForceChangePassword: () => <div>ForcePasswordScreen</div>,
}));

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<div>HomeContent</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AppShell password change flow', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      isBootstrapping: false,
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        name: 'Test User',
        email: 'test@company.com',
        role: { name: 'employee' },
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        forcePasswordChange: false,
        passwordChangePolicy: 'none',
      },
    });
  });

  it('bloquea navegación con pantalla forzada cuando estado es required', () => {
    useAuthStore.setState({
      user: {
        ...useAuthStore.getState().user!,
        passwordChangeState: 'required',
      },
    });

    renderShell();

    expect(screen.getByText('ForcePasswordScreen')).toBeInTheDocument();
    expect(screen.queryByText('HomeContent')).not.toBeInTheDocument();
  });

  it('muestra aviso no bloqueante cuando estado es warning', () => {
    const futureDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    useAuthStore.setState({
      user: {
        ...useAuthStore.getState().user!,
        passwordChangeState: 'warning',
        passwordChangeDeadlineAt: futureDeadline,
      },
    });

    renderShell();

    expect(screen.getByText('HomeContent')).toBeInTheDocument();
    expect(screen.getByText(/Debes actualizar tu contraseña antes de/i)).toBeInTheDocument();
  });

  it('si warning ya expiró, trata al usuario como required', () => {
    const expiredDeadline = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    useAuthStore.setState({
      user: {
        ...useAuthStore.getState().user!,
        passwordChangeState: 'warning',
        passwordChangeDeadlineAt: expiredDeadline,
      },
    });

    renderShell();

    expect(screen.getByText('ForcePasswordScreen')).toBeInTheDocument();
    expect(screen.queryByText('HomeContent')).not.toBeInTheDocument();
  });
});

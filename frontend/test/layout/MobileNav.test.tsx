/**
 * @file MobileNav.test.tsx
 * Tests del componente MobileNav (navegación móvil inferior).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MobileNav } from '@/components/layout/MobileNav';

const mockUser = {
  id: 'u1',
  name: 'Admin',
  role: { name: 'admin' },
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

function renderNav() {
  return render(
    <MemoryRouter>
      <MobileNav />
    </MemoryRouter>,
  );
}

describe('MobileNav', () => {
  it('renderiza enlaces principales (MAIN_NAV)', () => {
    renderNav();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Turnos')).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.getByText('Ausencias')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('renderiza botón "Más"', () => {
    renderNav();

    expect(screen.getByText('Más')).toBeInTheDocument();
  });

  it('abre menú de administración al hacer click en Más', async () => {
    renderNav();

    await userEvent.click(screen.getByText('Más'));
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('muestra sección "Administración" para admin', async () => {
    renderNav();

    await userEvent.click(screen.getByText('Más'));
    expect(screen.getByText('Administración')).toBeInTheDocument();
  });

  it('cierra menú al hacer click en un enlace', async () => {
    renderNav();

    await userEvent.click(screen.getByText('Más'));
    await userEvent.click(screen.getByText('Usuarios'));
    expect(document.getElementById('mobile-nav-extras')).toBeNull();
  });

  it('cierra menú al hacer click en overlay', async () => {
    renderNav();

    await userEvent.click(screen.getByText('Más'));
    const overlay = document.querySelector('.bg-black\\/20');
    if (overlay) {
      await userEvent.click(overlay);
      expect(document.getElementById('mobile-nav-extras')).toBeNull();
    }
  });
});

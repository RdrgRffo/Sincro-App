/**
 * @file ForbiddenPage.test.tsx
 * Tests del componente ForbiddenPage (error 403).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForbiddenPage } from '@/components/common/ForbiddenPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUser = {
  id: 'u1',
  name: 'Test User',
  role: { name: 'employee' },
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ForbiddenPage />
    </MemoryRouter>,
  );
}

describe('ForbiddenPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renderiza título y mensaje por defecto', () => {
    renderPage();

    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
    expect(screen.getByText('No tienes permisos para acceder a esta sección.')).toBeInTheDocument();
  });

  it('muestra el rol del usuario', () => {
    renderPage();

    expect(screen.getByText(/employee/)).toBeInTheDocument();
  });

  it('muestra mensaje personalizado', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage message="Mensaje personalizado" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Mensaje personalizado')).toBeInTheDocument();
  });

  it('navega hacia atrás al hacer click en Volver', async () => {
    renderPage();

    await userEvent.click(screen.getByText('Volver atrás'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('no muestra botón de login por defecto', () => {
    renderPage();

    expect(screen.queryByText('Iniciar sesión')).not.toBeInTheDocument();
  });

  it('muestra botón de login cuando showLoginButton es true', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage showLoginButton />
      </MemoryRouter>,
    );

    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
  });

  it('navega a /login al hacer click en Iniciar sesión', async () => {
    render(
      <MemoryRouter>
        <ForbiddenPage showLoginButton />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByText('Iniciar sesión'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

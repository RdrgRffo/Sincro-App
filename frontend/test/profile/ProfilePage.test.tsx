/**
 * @file ProfilePage.test.tsx
 * Tests de la página de perfil de usuario.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '@/pages/ProfilePage';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn() };
  return { default: toast, toast };
});

const mockUser = {
  id: 'user-1',
  name: 'Juan Pérez',
  email: 'juan@test.com',
  role: { name: 'employee' },
  branchId: 'b-1',
  department: { id: 'dept-1', name: 'Ventas' },
  createdAt: '2025-01-01T00:00:00Z',
  lastLoginAt: '2026-05-10T12:00:00Z',
  companyPhone: '123456789',
  auxiliaryPhone: null,
  forcePasswordChange: false,
  passwordChangePolicy: 'none',
  passwordChangeState: 'none',
  passwordChangeWarnedAt: null,
  passwordChangeDeadlineAt: null,
};

const mockAuthState = {
  user: mockUser,
  accessToken: 'token-123',
  refreshToken: 'refresh-123',
  isAuthenticated: true,
  isBootstrapping: false,
  setAuth: vi.fn(),
  setUser: vi.fn(),
  setTokens: vi.fn(),
  setAccessToken: vi.fn(),
  setBootstrapping: vi.fn(),
  logout: vi.fn(),
};

// Mock de zustand: soporta llamada con selector (función) o sin selector (undefined)
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  it('renderiza la información del usuario', async () => {
    renderPage();

    expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('juan@test.com')).toBeInTheDocument();
    expect(screen.getByText('Ventas')).toBeInTheDocument();
  });

  it('muestra el formulario de cambio de contraseña al hacer click', async () => {
    renderPage();

    await userEvent.click(screen.getByText('Cambiar'));
    expect(screen.getByText('Contraseña actual')).toBeInTheDocument();
    expect(screen.getByText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByText('Confirmar contraseña')).toBeInTheDocument();
  });

  it('cambia la contraseña correctamente', async () => {
    patchMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    await userEvent.click(screen.getByText('Cambiar'));

    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'oldpass123');
    await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'newpass123');
    await userEvent.type(screen.getByPlaceholderText('Repite la contraseña'), 'newpass123');

    await userEvent.click(screen.getByText('Actualizar contraseña'));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      });
    });
  });

  it('muestra permisos según rol employee', () => {
    renderPage();

    expect(screen.getByText('Ver planificación de guardias')).toBeInTheDocument();
    // Employee no debería ver opciones de admin
    expect(screen.queryByText('Gestión completa de usuarios')).not.toBeInTheDocument();
  });
});

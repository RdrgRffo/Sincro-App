/**
 * @file ProtectedRoute.test.tsx
 * Tests de ProtectedRoute y RoleGuard: redirecciones según estado de auth y rol.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, RoleGuard } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

const mockUser: User = {
  id: 'u1', name: 'Admin', email: 'a@a.com',
  role: { name: 'admin' }, status: 'active', avatarUrl: undefined,
  department: null, forcePasswordChange: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isBootstrapping: false });
});

// ── Helper: monta el router con una ruta protegida ───────────────────────────
function mountProtected(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Página Login</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Área Protegida</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('ProtectedRoute', () => {
  it('redirige a /login cuando el usuario NO está autenticado', () => {
    mountProtected();
    expect(screen.getByText('Página Login')).toBeInTheDocument();
    expect(screen.queryByText('Área Protegida')).not.toBeInTheDocument();
  });

  it('muestra el contenido protegido cuando el usuario SÍ está autenticado', () => {
    useAuthStore.setState({ isAuthenticated: true, isBootstrapping: false, user: mockUser });
    mountProtected();
    expect(screen.getByText('Área Protegida')).toBeInTheDocument();
  });

  it('muestra spinner de carga mientras isBootstrapping=true', () => {
    useAuthStore.setState({ isAuthenticated: true, isBootstrapping: true });
    const { container } = mountProtected();
    // El spinner es un div con border-radius 50%
    const spinner = container.querySelector('div[style*="border-radius: 50%"]');
    expect(spinner).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('RoleGuard', () => {
  function mountRoleGuard(allowedRoles: string[]) {
    return render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route element={<RoleGuard roles={allowedRoles} />}>
            <Route path="/admin" element={<div>Panel Admin</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it('muestra ForbiddenPage cuando el usuario no tiene el rol requerido', () => {
    useAuthStore.setState({ user: { ...mockUser, role: { name: 'employee' } }, isAuthenticated: true });
    mountRoleGuard(['admin', 'general_manager']);
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
    expect(screen.queryByText('Panel Admin')).not.toBeInTheDocument();
  });

  it('permite el acceso cuando el usuario tiene un rol de la lista', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true }); // role: 'admin'
    mountRoleGuard(['admin', 'general_manager']);
    expect(screen.getByText('Panel Admin')).toBeInTheDocument();
  });

  it('muestra ForbiddenPage cuando no hay usuario logueado (user=null)', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    mountRoleGuard(['admin']);
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
  });
});

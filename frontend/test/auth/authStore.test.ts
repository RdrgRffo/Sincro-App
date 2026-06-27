/**
 * @file authStore.test.ts
 * Tests del store de autenticación (Zustand): estado inicial, setAuth, logout, setTokens.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

// ── Helper: usuario ficticio ─────────────────────────────────────────────────
const mockUser: User = {
  id: 'user-1',
  name: 'Admin Test',
  email: 'admin@test.com',
  role: 'admin',
  status: 'active',
  avatarUrl: null,
  department: null,
  forcePasswordChange: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Reseteamos el store entre tests para aislar estado
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isBootstrapping: false,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('authStore - Estado inicial', () => {
  it('arranca sin usuario autenticado', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('authStore - setAuth', () => {
  it('setAuth marca isAuthenticated como true e inyecta user y tokens', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-tok', 'refresh-tok');
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-tok');
    expect(state.refreshToken).toBe('refresh-tok');
    expect(state.isBootstrapping).toBe(false); // se limpia siempre
  });

  it('setAuth con token vacío sigue marcando como autenticado (el guard lo validará)', () => {
    useAuthStore.getState().setAuth(mockUser, '', '');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('authStore - setTokens', () => {
  it('actualiza solo los tokens sin cambiar el user', () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    useAuthStore.getState().setTokens('new-access', 'new-refresh');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.user).toEqual(mockUser); // no tocado
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('authStore - setAccessToken', () => {
  it('rota solo el accessToken (usado por el interceptor de refresco)', () => {
    useAuthStore.setState({ accessToken: 'old-tok', refreshToken: 'ref-tok' });
    useAuthStore.getState().setAccessToken('new-tok');

    expect(useAuthStore.getState().accessToken).toBe('new-tok');
    expect(useAuthStore.getState().refreshToken).toBe('ref-tok'); // intacto
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('authStore - logout', () => {
  it('limpia absolutamente todo el estado de sesión', () => {
    useAuthStore.getState().setAuth(mockUser, 'tok', 'ref');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isBootstrapping).toBe(false);
  });

  it('logout sobre estado ya vacío no rompe (idempotente)', () => {
    expect(() => useAuthStore.getState().logout()).not.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

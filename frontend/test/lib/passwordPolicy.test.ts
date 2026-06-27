/**
 * @file passwordPolicy.test.ts
 * unifica estado requerido/aviso de cambio de contraseña (policy, estado explícito, deadline).
 */
import { describe, it, expect } from 'vitest';
import { resolvePasswordChangeState } from '@/lib/passwordPolicy';
import type { User } from '@/types';

const baseUser: User = {
  id: 'u1',
  name: 'Test',
  email: 't@test.com',
  role: { name: 'employee' },
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('resolvePasswordChangeState', () => {
  it('null o undefined => none', () => {
    expect(resolvePasswordChangeState(null)).toBe('none');
    expect(resolvePasswordChangeState(undefined)).toBe('none');
  });

  it('passwordChangeState explícito tiene prioridad: required', () => {
    const u: User = {
      ...baseUser,
      passwordChangeState: 'required',
      passwordChangePolicy: 'none',
      forcePasswordChange: false,
    };
    expect(resolvePasswordChangeState(u)).toBe('required');
  });

  it('warning pasa a required si deadline ya venció', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    const u: User = {
      ...baseUser,
      passwordChangeState: 'warning',
      passwordChangeDeadlineAt: '2026-06-01T00:00:00.000Z',
    };
    expect(resolvePasswordChangeState(u, now)).toBe('required');
  });

  it('warning se mantiene si deadline es futuro', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const u: User = {
      ...baseUser,
      passwordChangeState: 'warning',
      passwordChangeDeadlineAt: '2026-12-31T00:00:00.000Z',
    };
    expect(resolvePasswordChangeState(u, now)).toBe('warning');
  });

  it('política requerida sin estado explícito', () => {
    const u: User = { ...baseUser, passwordChangePolicy: 'required' };
    expect(resolvePasswordChangeState(u)).toBe('required');
  });

  it('política warning con deadline vencida', () => {
    const now = new Date('2026-02-01T00:00:00Z');
    const u: User = {
      ...baseUser,
      passwordChangePolicy: 'warning',
      passwordChangeDeadlineAt: '2026-01-01T00:00:00.000Z',
    };
    expect(resolvePasswordChangeState(u, now)).toBe('required');
  });

  it('forcePasswordChange fuerza required', () => {
    const u: User = {
      ...baseUser,
      passwordChangePolicy: 'none',
      passwordChangeState: 'none' as const,
      forcePasswordChange: true,
    };
    expect(resolvePasswordChangeState(u)).toBe('required');
  });

  it('ninguna condición => none', () => {
    const u: User = {
      ...baseUser,
      passwordChangePolicy: 'none',
      forcePasswordChange: false,
    };
    expect(resolvePasswordChangeState(u)).toBe('none');
  });
});

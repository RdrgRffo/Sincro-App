/**
 * @file utils.test.ts
 * Utilidades de formato, clases e iniciales reutilizadas en la UI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cn, formatDate, formatTime, getInitials, getAvatarColor } from '@/lib/utils';

describe('cn', () => {
  it('merge de clases tailwind en conflicto', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('acepta condicionales falsy', () => {
    const falsy = false;
    expect(cn('a', falsy && 'b', 'c')).toBe('a c');
  });
});

describe('formatDate y formatTime', () => {
  it('formatea fecha fija en español (dd/MM/yyyy)', () => {
    const d = new Date('2026-04-15T12:00:00Z');
    expect(formatDate(d)).toBe('15/04/2026');
  });

  it('formatea hora local HH:mm', () => {
    const d = new Date(2026, 3, 15, 9, 5, 0);
    expect(formatTime(d)).toBe('09:05');
  });
});

describe('getInitials', () => {
  it('toma como máximo dos partes', () => {
    expect(getInitials('Ana García López')).toBe('AG');
  });

  it('con una sola palabra devuelve un carácter', () => {
    expect(getInitials('Admin')).toBe('A');
  });
});

describe('getAvatarColor', () => {
  const root = document.documentElement;
  const THEME_PROPS = [
    '--theme-sidebar-active-bg',
    '--color-navy-600',
    '--color-gold-400',
    '--theme-btn-danger-bg',
    '--theme-badge-active-text',
    '--theme-badge-manager-bg',
    '--theme-calendar-active-button',
    '--theme-calendar-now-indicator',
  ] as const;

  beforeEach(() => {
    for (const p of THEME_PROPS) root.style.removeProperty(p);
  });

  afterEach(() => {
    for (const p of THEME_PROPS) root.style.removeProperty(p);
  });

  it('elige un color de la paleta de forma determinista para el mismo nombre', () => {
    const a = getAvatarColor('Mismo Usuario');
    const b = getAvatarColor('Mismo Usuario');
    expect(a).toBe(b);
    expect(a).toMatch(/^#/);
  });

  it('usa la paleta derivada de variables CSS de tema (todas iguales = mismo color)', () => {
    for (const p of THEME_PROPS) {
      root.style.setProperty(p, '#aabbcc');
    }
    expect(getAvatarColor('Uno')).toBe('#aabbcc');
    expect(getAvatarColor('Otro')).toBe('#aabbcc');
  });
});

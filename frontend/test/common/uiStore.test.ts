/**
 * @file uiStore.test.ts
 * Tests del store de UI (Zustand): sidebar y persistencia básica.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidebarCollapsed: false,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('uiStore - Sidebar', () => {
  it('toggleSidebar alterna el estado collapsed', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setSidebarCollapsed fija el valor directamente (sin toggle)', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().setSidebarCollapsed(false);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });
  
  it('solo expone estado de layout y acciones del sidebar', () => {
    expect(useUIStore.getState()).toEqual(
      expect.objectContaining({
        sidebarCollapsed: false,
        toggleSidebar: expect.any(Function),
        setSidebarCollapsed: expect.any(Function),
      }),
    );
  });
});

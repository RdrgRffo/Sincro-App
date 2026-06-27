/**
 * @file useInAppNotifications.test.ts
 * Tests del hook de notificaciones in-app.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInAppNotifications } from '@/hooks/useInAppNotifications';

const getMock = vi.fn();
const patchMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

const mockNotifications = [
  { id: 'n1', userId: 'u1', type: 'info', title: 'Notif 1', message: 'Mensaje 1', link: null, metadata: null, readAt: null, createdAt: '2026-05-10T10:00:00Z' },
  { id: 'n2', userId: 'u1', type: 'warning', title: 'Notif 2', message: 'Mensaje 2', link: '/schedules', metadata: null, readAt: '2026-05-10T12:00:00Z', createdAt: '2026-05-09T10:00:00Z' },
];

/** Forma real del backend (`sendPaginated`) tras axios (`response.data`) */
function mockListEnvelope(items: typeof mockNotifications) {
  return {
    data: {
      success: true,
      data: items,
      pagination: {
        total: items.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  };
}

describe('useInAppNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getMock.mockResolvedValue({ data: { data: { count: 1 } } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inicializa con valores por defecto', () => {
    const { result } = renderHook(() => useInAppNotifications());

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetchUnreadCount obtiene el contador de no leídas', async () => {
    getMock.mockResolvedValue({ data: { data: { count: 5 } } });

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchUnreadCount();
    });

    expect(getMock).toHaveBeenCalledWith('/in-app-notifications/unread-count');
    expect(result.current.unreadCount).toBe(5);
  });

  it('fetchNotifications obtiene la lista paginada', async () => {
    getMock.mockResolvedValue(mockListEnvelope(mockNotifications));

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(getMock).toHaveBeenCalledWith('/in-app-notifications', { params: { page: 1, pageSize: 20 } });
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.pagination.total).toBe(2);
  });

  it('markAsRead marca una notificación como leída', async () => {
    getMock.mockResolvedValue(mockListEnvelope(mockNotifications));

    patchMock.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.markAsRead('n1');
    });

    expect(patchMock).toHaveBeenCalledWith('/in-app-notifications/n1/read');
    const n1 = result.current.notifications.find((n) => n.id === 'n1');
    expect(n1?.readAt).not.toBeNull();
  });

  it('markAllAsRead marca todas como leídas', async () => {
    getMock.mockResolvedValue(mockListEnvelope(mockNotifications));

    postMock.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(postMock).toHaveBeenCalledWith('/in-app-notifications/read-all');
    expect(result.current.unreadCount).toBe(0);
  });

  it('fetchUnreadCount falla silenciosamente', async () => {
    getMock.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchUnreadCount();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('fetchNotifications falla silenciosamente', async () => {
    getMock.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(result.current.loading).toBe(false);
  });

  it('deleteNotification elimina una notificación de la lista', async () => {
    getMock.mockResolvedValue(mockListEnvelope(mockNotifications));
    deleteMock.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.deleteNotification('n1');
    });

    expect(deleteMock).toHaveBeenCalledWith('/in-app-notifications/n1');
    expect(result.current.notifications.find((n) => n.id === 'n1')).toBeUndefined();
  });

  it('deleteAllNotifications limpia toda la bandeja', async () => {
    getMock.mockResolvedValue(mockListEnvelope(mockNotifications));
    deleteMock.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useInAppNotifications());

    await act(async () => {
      await result.current.fetchNotifications();
    });

    await act(async () => {
      await result.current.deleteAllNotifications();
    });

    expect(deleteMock).toHaveBeenCalledWith('/in-app-notifications');
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});

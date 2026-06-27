/**
 * @file NotificationPanel.test.tsx
 * Tests del componente NotificationPanel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationPanel } from '@/components/common/NotificationPanel';
import type { InAppNotification } from '@/hooks/useInAppNotifications';

const mockNotifications: InAppNotification[] = [
  { id: 'n1', userId: 'u1', type: 'absence_approved', title: 'Ausencia aprobada', message: 'Disfruta', link: null, metadata: null, readAt: null, createdAt: new Date().toISOString() },
  { id: 'n2', userId: 'u1', type: 'info', title: 'Notificación leída', message: 'Ya leída', link: null, metadata: null, readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 3600000).toISOString() },
];

const defaultProps = {
  unreadCount: 1,
  notifications: mockNotifications,
  loading: false,
  onMarkAsRead: vi.fn(),
  onMarkAllAsRead: vi.fn(),
  onDelete: vi.fn(),
  onDeleteAll: vi.fn(),
  onRefresh: vi.fn(),
  onFetchMore: vi.fn(),
  pagination: { page: 1, total: 2, totalPages: 1 },
};

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza botón de campana con contador', () => {
    render(<NotificationPanel {...defaultProps} />);

    const bell = screen.getByLabelText('Notificaciones (1 sin leer)');
    expect(bell).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('no muestra contador cuando unreadCount es 0', () => {
    render(<NotificationPanel {...defaultProps} unreadCount={0} />);

    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('abre panel al hacer click en campana', async () => {
    render(<NotificationPanel {...defaultProps} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
  });

  it('muestra lista de notificaciones', async () => {
    render(<NotificationPanel {...defaultProps} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    expect(screen.getByText('Ausencia aprobada')).toBeInTheDocument();
    expect(screen.getByText('Notificación leída')).toBeInTheDocument();
  });

  it('llama a onMarkAsRead al hacer click en no leída', async () => {
    const onMarkAsRead = vi.fn();
    render(<NotificationPanel {...defaultProps} onMarkAsRead={onMarkAsRead} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    await userEvent.click(screen.getByText('Ausencia aprobada'));
    expect(onMarkAsRead).toHaveBeenCalledWith('n1');
  });

  it('llama a onMarkAllAsRead al hacer click en Leer todas', async () => {
    const onMarkAllAsRead = vi.fn();
    render(<NotificationPanel {...defaultProps} onMarkAllAsRead={onMarkAllAsRead} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    await userEvent.click(screen.getByText('Leer todas'));
    expect(onMarkAllAsRead).toHaveBeenCalled();
  });

  it('muestra "No hay notificaciones" cuando lista vacía', async () => {
    render(<NotificationPanel {...defaultProps} notifications={[]} unreadCount={0} />);

    await userEvent.click(screen.getByLabelText('Notificaciones'));
    expect(screen.getByText('No hay notificaciones')).toBeInTheDocument();
  });

  it('muestra spinner cuando loading y no hay notificaciones', async () => {
    render(<NotificationPanel {...defaultProps} notifications={[]} loading unreadCount={0} />);

    await userEvent.click(screen.getByLabelText('Notificaciones'));
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('muestra botón "Ver más" cuando hay más páginas', async () => {
    render(<NotificationPanel {...defaultProps} pagination={{ page: 1, total: 10, totalPages: 2 }} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    expect(screen.getByText('Ver más')).toBeInTheDocument();
  });

  it('llama a onFetchMore al hacer click en Ver más', async () => {
    const onFetchMore = vi.fn();
    render(<NotificationPanel {...defaultProps} onFetchMore={onFetchMore} pagination={{ page: 1, total: 10, totalPages: 2 }} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    await userEvent.click(screen.getByText('Ver más'));
    expect(onFetchMore).toHaveBeenCalledWith(2);
  });

  it('llama a onDelete al borrar una notificación', async () => {
    const onDelete = vi.fn();
    render(<NotificationPanel {...defaultProps} onDelete={onDelete} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    await userEvent.click(screen.getAllByLabelText('Eliminar notificación')[0]);

    expect(onDelete).toHaveBeenCalledWith('n1');
  });

  it('llama a onDeleteAll al hacer click en "Borrar todo"', async () => {
    const onDeleteAll = vi.fn();
    render(<NotificationPanel {...defaultProps} onDeleteAll={onDeleteAll} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    await userEvent.click(screen.getByText('Borrar todo'));

    expect(onDeleteAll).toHaveBeenCalled();
  });

  it('muestra total de notificaciones en footer', async () => {
    render(<NotificationPanel {...defaultProps} />);

    await userEvent.click(screen.getByLabelText('Notificaciones (1 sin leer)'));
    expect(screen.getByText('2 notificaciones en total')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserActionMenu } from '@/components/users/UserActionMenu';
import type { User } from '@/types';

const mockUser: User = {
  id: '1', name: 'Juan Pérez', email: 'juan@test.com', role: { name: 'admin' }, status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
} as User;

const mockDisabledUser: User = {
  id: '2', name: 'María López', email: 'maria@test.com', role: { name: 'employee' }, status: 'disabled',
  createdAt: '2024-01-01T00:00:00Z',
} as User;

const baseProps = {
  position: { top: 100, left: 100 },
  onClose: vi.fn(),
  onViewDetail: vi.fn(),
  onEdit: vi.fn(),
  onResetPassword: vi.fn(),
  onForcePasswordChange: vi.fn(),
  onToggleStatus: vi.fn(),
  onDelete: vi.fn(),
};

describe('UserActionMenu', () => {
  it('muestra opciones básicas para cualquier rol', () => {
    render(<UserActionMenu user={mockUser} isAdmin={false} {...baseProps} />);
    expect(screen.getByText('Ver detalle')).toBeDefined();
  });

  it('muestra opciones de admin cuando isAdmin=true', () => {
    render(<UserActionMenu user={mockUser} isAdmin={true} {...baseProps} />);
    expect(screen.getByText('Editar')).toBeDefined();
    expect(screen.getByText('Resetear contraseña')).toBeDefined();
    expect(screen.getByText('Forzar cambio de contraseña')).toBeDefined();
    expect(screen.getByText('Eliminar')).toBeDefined();
  });

  it('no muestra opciones de admin cuando isAdmin=false', () => {
    render(<UserActionMenu user={mockUser} isAdmin={false} {...baseProps} />);
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Eliminar')).toBeNull();
  });

  it('muestra "Bloquear" para usuario activo', () => {
    render(<UserActionMenu user={mockUser} isAdmin={true} {...baseProps} />);
    expect(screen.getByText('Bloquear')).toBeDefined();
  });

  it('muestra "Activar" para usuario no activo', () => {
    render(<UserActionMenu user={mockDisabledUser} isAdmin={true} {...baseProps} />);
    expect(screen.getByText('Activar')).toBeDefined();
  });

  it('llama a onViewDetail al hacer clic en Ver detalle', async () => {
    const onViewDetail = vi.fn();
    render(<UserActionMenu user={mockUser} isAdmin={false} {...baseProps} onViewDetail={onViewDetail} />);
    await userEvent.click(screen.getByText('Ver detalle'));
    expect(onViewDetail).toHaveBeenCalledWith(mockUser);
  });

  it('llama a onEdit al hacer clic en Editar', async () => {
    const onEdit = vi.fn();
    render(<UserActionMenu user={mockUser} isAdmin={true} {...baseProps} onEdit={onEdit} />);
    await userEvent.click(screen.getByText('Editar'));
    expect(onEdit).toHaveBeenCalledWith(mockUser);
  });

  it('llama a onDelete al hacer clic en Eliminar', async () => {
    const onDelete = vi.fn();
    render(<UserActionMenu user={mockUser} isAdmin={true} {...baseProps} onDelete={onDelete} />);
    await userEvent.click(screen.getByText('Eliminar'));
    expect(onDelete).toHaveBeenCalledWith(mockUser);
  });

  it('llama a onClose al hacer clic fuera del menú', async () => {
    const onClose = vi.fn();
    render(<UserActionMenu user={mockUser} isAdmin={false} {...baseProps} onClose={onClose} />);
    const backdrop = document.querySelector('.fixed.inset-0.z-40');
    if (backdrop) {
      await userEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });
});

/**
 * @file ConfirmDialog.test.tsx
 * Tests del componente ConfirmDialog: visibilidad, variantes, callbacks.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const baseProps = {
  open: true,
  title: 'Eliminar usuario',
  description: '¿Estás seguro? Esta acción no se puede deshacer.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

// ═══════════════════════════════════════════════════════════════════════════════
describe('ConfirmDialog - Visibilidad', () => {
  it('no renderiza nada cuando open=false (nodo nulo)', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza el título y descripción cuando open=true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Eliminar usuario')).toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('ConfirmDialog - Labels personalizados', () => {
  it('usa los labels por defecto "Confirmar" y "Cancelar"', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Cancelar/i })).toHaveLength(1);
  });

  it('acepta labels personalizados via props', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Sí, borrar" cancelLabel="Volver" />);
    expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('ConfirmDialog - Callbacks', () => {
  it('llama a onConfirm al pulsar el botón de confirmación', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('llama a onCancel al pulsar el botón cancelar', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('llama a onCancel al pulsar la X de cierre', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    // La X tiene aria implícita como botón
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find(b => b.className.includes('text-theme-muted'));
    fireEvent.click(closeBtn!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('ConfirmDialog - Estado loading', () => {
  it('deshabilita el botón de confirmación mientras loading=true', () => {
    render(<ConfirmDialog {...baseProps} loading={true} />);
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('botón habilitado cuando loading=false (valor por defecto)', () => {
    render(<ConfirmDialog {...baseProps} loading={false} />);
    expect(screen.getByRole('button', { name: /Confirmar/i })).not.toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('ConfirmDialog - Variantes de color', () => {
  it('variante danger aplica clases de rojo al botón', () => {
    render(<ConfirmDialog {...baseProps} variant="danger" />);
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
    expect(confirmBtn.className).toContain('bg-red-500');
  });

  it('variante warning aplica clases ámbar al botón', () => {
    render(<ConfirmDialog {...baseProps} variant="warning" />);
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
    expect(confirmBtn.className).toContain('bg-amber-500');
  });
});

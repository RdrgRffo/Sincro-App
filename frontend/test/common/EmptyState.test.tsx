/**
 * @file EmptyState.test.tsx
 * Tests del componente EmptyState: contenido condicional, action, className.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/common/EmptyState';
import { Inbox } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
describe('EmptyState - Renderizado básico', () => {
  it('muestra el título siempre', () => {
    render(<EmptyState icon={Inbox} title="Sin resultados" />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('NO renderiza la descripción si no se pasa', () => {
    render(<EmptyState icon={Inbox} title="Vacío" />);
    // Solo hay un texto: el título
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renderiza la descripción cuando se proporciona', () => {
    render(<EmptyState icon={Inbox} title="Vacío" description="No hay nada aquí todavía." />);
    expect(screen.getByText('No hay nada aquí todavía.')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('EmptyState - Action slot', () => {
  it('no renderiza el contenedor de action si no se pasa', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Vacío" />);
    // El mt-4 del action wrapper no debe existir
    expect(container.querySelector('.mt-4')).not.toBeInTheDocument();
  });

  it('renderiza la acción cuando se proporciona como nodo React', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Vacío"
        action={<button>Crear ahora</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Crear ahora' })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('EmptyState - className override', () => {
  it('añade className personalizado al contenedor raíz', () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="X" className="custom-test-class" />
    );
    expect(container.firstChild).toHaveClass('custom-test-class');
  });
});

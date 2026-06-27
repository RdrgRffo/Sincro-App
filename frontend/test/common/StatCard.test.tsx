/**
 * @file StatCard.test.tsx
 * Tests del componente StatCard: renderizado, variantes de color, trend positivo/negativo.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/common/StatCard';
import { Users } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
describe('StatCard - Renderizado básico', () => {
  it('renderiza el título y valor correctamente', () => {
    render(<StatCard title="Usuarios Activos" value={42} icon={Users} />);
    expect(screen.getByText('Usuarios Activos')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('acepta value como string (p.ej. porcentajes)', () => {
    render(<StatCard title="Ocupación" value="87%" icon={Users} />);
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('no renderiza la sección trend si no se pasa la prop', () => {
    const { container } = render(<StatCard title="Sin Trend" value={10} icon={Users} />);
    // No debe haber spans con clases de color de trend
    expect(container.querySelector('.text-emerald-600')).not.toBeInTheDocument();
    expect(container.querySelector('.text-red-500')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('StatCard - Trend positivo vs negativo', () => {
  it('trend con valor positivo muestra prefijo + y clase verde', () => {
    render(<StatCard title="X" value={10} icon={Users} trend={{ value: 5, label: 'este mes' }} />);
    const trendSpan = screen.getByText(/\+5/);
    expect(trendSpan).toBeInTheDocument();
    expect(trendSpan.className).toContain('text-emerald-600');
  });

  it('trend con valor 0 también muestra + (límite exacto del operador >=)', () => {
    render(<StatCard title="X" value={10} icon={Users} trend={{ value: 0, label: 'este mes' }} />);
    expect(screen.getByText(/\+0/)).toBeInTheDocument();
  });

  it('trend negativo no muestra + y usa clase roja', () => {
    render(<StatCard title="X" value={10} icon={Users} trend={{ value: -3, label: 'este mes' }} />);
    const trendSpan = screen.getByText('-3');
    expect(trendSpan.className).toContain('text-red-500');
    expect(screen.queryByText('+−3')).not.toBeInTheDocument();
  });

  it('muestra el label de trend junto al valor', () => {
    render(<StatCard title="X" value={10} icon={Users} trend={{ value: 2, label: 'vs semana pasada' }} />);
    expect(screen.getByText(/vs semana pasada/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('StatCard - Variantes de color', () => {
  it('sin color especificado usa navy por defecto', () => {
    const { container } = render(<StatCard title="X" value={1} icon={Users} />);
    // El ícono wrapper debe contener bg-navy-50
    // Default icon wrapper should use theme muted token (monochrome), not a colored background.
    expect(container.querySelector('.bg-theme-muted')).toBeInTheDocument();
  });

  it('color=green aplica clases de emerald', () => {
    const { container } = render(<StatCard title="X" value={1} icon={Users} color="green" />);
    expect(container.querySelector('.bg-emerald-50')).toBeInTheDocument();
  });
});

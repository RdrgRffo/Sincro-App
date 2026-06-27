/**
 * @file LoadingSpinner.test.tsx
 * Tests del componente LoadingSpinner.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renderiza el spinner', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass('animate-spin');
  });

  it('aplica tamaño sm', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner.className).toContain('h-4');
    expect(spinner.className).toContain('w-4');
  });

  it('aplica tamaño md por defecto', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner.className).toContain('h-8');
    expect(spinner.className).toContain('w-8');
  });

  it('aplica tamaño lg', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner.className).toContain('h-12');
    expect(spinner.className).toContain('w-12');
  });

  it('aplica className adicional', () => {
    const { container } = render(<LoadingSpinner className="extra-class" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner.className).toContain('extra-class');
  });

  it('renderiza fullScreen con texto', () => {
    render(<LoadingSpinner fullScreen />);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('fullScreen tiene clase fixed', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
  });
});

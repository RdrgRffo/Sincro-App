/**
 * @file FilterTable.test.tsx
 * Tests del componente FilterTable.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterTable } from '@/components/common/FilterTable';
import type { FilterFieldConfig } from '@/components/common/FilterTable';

type TestFilters = 'search' | 'status' | 'date';

const fields: FilterFieldConfig<TestFilters>[] = [
  { key: 'search', type: 'text', label: 'Buscar', placeholder: 'Buscar...' },
  { key: 'status', type: 'select', label: 'Estado', options: [
    { value: '', label: 'Todos' },
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
  ]},
  { key: 'date', type: 'date', label: 'Fecha' },
];

describe('FilterTable', () => {
  it('renderiza campos de texto y select', () => {
    render(
      <FilterTable
        fields={fields}
        values={{ search: '', status: '', date: '' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('oculta filtros de fecha por defecto', () => {
    render(
      <FilterTable
        fields={fields}
        values={{ search: '', status: '', date: '' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('más filtros')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha')).not.toBeInTheDocument();
  });

  it('muestra filtros de fecha al hacer click en "más filtros"', async () => {
    render(
      <FilterTable
        fields={fields}
        values={{ search: '', status: '', date: '' }}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText('más filtros'));
    expect(screen.getByText('Ocultar filtros de fecha')).toBeInTheDocument();
  });

  it('llama a onChange al escribir en campo de texto', async () => {
    const onChange = vi.fn();

    render(
      <FilterTable
        fields={fields}
        values={{ search: '', status: '', date: '' }}
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText('Buscar...'), 'test');
    expect(onChange).toHaveBeenCalledWith('search', 't');
  });

  it('llama a onChange al seleccionar opción', async () => {
    const onChange = vi.fn();

    render(
      <FilterTable
        fields={fields}
        values={{ search: '', status: '', date: '' }}
        onChange={onChange}
      />,
    );

    await userEvent.selectOptions(screen.getByRole('combobox'), 'active');
    expect(onChange).toHaveBeenCalledWith('status', 'active');
  });

  it('aplica className personalizado', () => {
    const { container } = render(
      <FilterTable
        fields={fields}
        values={{ search: '', status: '', date: '' }}
        onChange={vi.fn()}
        className="custom-class"
      />,
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('deshabilita campos cuando disabled es true', () => {
    const disabledFields: FilterFieldConfig<TestFilters>[] = [
      { key: 'search', type: 'text', label: 'Buscar', disabled: true },
    ];

    render(
      <FilterTable
        fields={disabledFields}
        values={{ search: '', status: '', date: '' }}
        onChange={vi.fn()}
      />,
    );

    // El input está deshabilitado, búscalo por label
    expect(screen.getByLabelText('Buscar')).toBeDisabled();
  });
});

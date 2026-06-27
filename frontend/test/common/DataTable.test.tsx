/**
 * @file DataTable.test.tsx
 * Tests del componente DataTable genérico.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/common/DataTable';
import type { Column } from '@/components/common/DataTable';

// Mock EmptyState para evitar problemas con LucideIcon
vi.mock('@/components/common/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {description && <span>{description}</span>}
    </div>
  ),
}));

interface TestItem {
  id: string;
  name: string;
  email: string;
}

const columns: Column<TestItem>[] = [
  { key: 'name', label: 'Nombre', sortable: true, render: (item) => item.name },
  { key: 'email', label: 'Email', sortable: true, render: (item) => item.email },
];

const data: TestItem[] = [
  { id: '1', name: 'Juan', email: 'juan@test.com' },
  { id: '2', name: 'María', email: 'maria@test.com' },
];

describe('DataTable', () => {
  it('renderiza datos correctamente', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
      />,
    );

    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('María')).toBeInTheDocument();
    expect(screen.getByText('juan@test.com')).toBeInTheDocument();
  });

  it('renderiza cabeceras de columnas', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
      />,
    );

    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('muestra EmptyState cuando no hay datos', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        rowKey={(item) => item.id}
        emptyTitle="Sin registros"
        emptyDescription="No hay datos disponibles"
      />,
    );

    expect(screen.getByText('Sin registros')).toBeInTheDocument();
    expect(screen.getByText('No hay datos disponibles')).toBeInTheDocument();
  });

  it('muestra spinner cuando isLoading', () => {
    const { container } = render(
      <DataTable
        data={[]}
        columns={columns}
        rowKey={(item) => item.id}
        isLoading
      />,
    );

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('llama a onSortChange al hacer click en columna ordenable', async () => {
    const onSortChange = vi.fn();

    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
        onSortChange={onSortChange}
      />,
    );

    await userEvent.click(screen.getByText('Nombre'));
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  it('muestra indicador de ordenación activo', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
        sortBy="name"
        sortOrder="asc"
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByText('▲')).toBeInTheDocument();
  });

  it('renderiza acciones cuando se proporciona renderActions', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
        renderActions={(item) => <button>Editar {item.name}</button>}
      />,
    );

    expect(screen.getByText('Editar Juan')).toBeInTheDocument();
    expect(screen.getByText('Editar María')).toBeInTheDocument();
    expect(screen.getByText('Acciones')).toBeInTheDocument();
  });

  it('llama a onRowClick al hacer click en fila', async () => {
    const onRowClick = vi.fn();

    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
        onRowClick={onRowClick}
      />,
    );

    await userEvent.click(screen.getByText('Juan'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('aplica clase por fila cuando se proporciona getRowClassName', () => {
    const { container } = render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
        getRowClassName={(item) => (item.id === '1' ? 'bg-selected' : '')}
      />,
    );

    const firstRow = container.querySelector('tbody tr');
    expect(firstRow?.className).toContain('bg-selected');
  });

  it('permite personalizar la cabecera de acciones', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={(item) => item.id}
        actionsLabel=""
        renderActions={(item) => <button>Ver {item.name}</button>}
      />,
    );

    expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
    expect(screen.getByText('Ver Juan')).toBeInTheDocument();
  });

  it('aplica clase hide en columnas según configuración', () => {
    const colsWithHide: Column<TestItem>[] = [
      { key: 'name', label: 'Nombre', render: (item) => item.name },
      { key: 'email', label: 'Email', hide: 'md', render: (item) => item.email },
    ];

    const { container } = render(
      <DataTable
        data={data}
        columns={colsWithHide}
        rowKey={(item) => item.id}
      />,
    );

    const ths = container.querySelectorAll('th');
    expect(ths[1].className).toContain('hidden md:table-cell');
  });
});

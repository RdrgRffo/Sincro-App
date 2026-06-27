import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersPagination } from '@/components/users/UsersPagination';

describe('UsersPagination', () => {
  it('no renderiza nada cuando totalPages es 0', () => {
    const { container } = render(
      <UsersPagination page={1} totalPages={0} total={0} limit={15} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('muestra el rango de resultados', () => {
    render(
      <UsersPagination page={1} totalPages={5} total={50} limit={15} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    );
    expect(screen.getByText(/1–15 de 50/)).toBeDefined();
  });

  it('muestra botones de navegación cuando hay más de 1 página', () => {
    render(
      <UsersPagination page={2} totalPages={5} total={50} limit={15} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    );
    expect(screen.getByText('Anterior')).toBeDefined();
    expect(screen.getByText('Siguiente')).toBeDefined();
  });

  it('deshabilita Anterior en primera página', () => {
    render(
      <UsersPagination page={1} totalPages={5} total={50} limit={15} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    );
    expect(screen.getByText('Anterior')).toBeDisabled();
  });

  it('deshabilita Siguiente en última página', () => {
    render(
      <UsersPagination page={5} totalPages={5} total={50} limit={15} onPageChange={vi.fn()} onLimitChange={vi.fn()} />,
    );
    expect(screen.getByText('Siguiente')).toBeDisabled();
  });

  it('llama a onPageChange al hacer clic en Siguiente', async () => {
    const onPageChange = vi.fn();
    render(
      <UsersPagination page={1} totalPages={5} total={50} limit={15} onPageChange={onPageChange} onLimitChange={vi.fn()} />,
    );
    await userEvent.click(screen.getByText('Siguiente'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('llama a onPageChange al hacer clic en Anterior', async () => {
    const onPageChange = vi.fn();
    render(
      <UsersPagination page={3} totalPages={5} total={50} limit={15} onPageChange={onPageChange} onLimitChange={vi.fn()} />,
    );
    await userEvent.click(screen.getByText('Anterior'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('llama a onLimitChange al cambiar el select de límite', async () => {
    const onLimitChange = vi.fn();
    render(
      <UsersPagination page={1} totalPages={5} total={50} limit={15} onPageChange={vi.fn()} onLimitChange={onLimitChange} />,
    );
    const select = screen.getByLabelText('Mostrar:');
    await userEvent.selectOptions(select, '25');
    expect(onLimitChange).toHaveBeenCalledWith(25);
  });
});

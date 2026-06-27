import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HolidayEditModal } from '@/components/schedule/HolidayEditModal';
import type { BranchHoliday } from '@/types';

const patchMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function buildHoliday(overrides: Partial<BranchHoliday> = {}): BranchHoliday {
  return {
    id: 'h-1',
    branchId: 'branch-1',
    date: '2026-03-29T00:00:00.000Z',
    name: 'Domingo de Ramos',
    type: 'regional',
    scope: 'regional',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HolidayEditModal', () => {
  beforeEach(() => {
    patchMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('no renderiza cuando open=false', () => {
    const { container } = renderWithQuery(
      <HolidayEditModal
        open={false}
        holiday={buildHoliday()}
        onClose={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('carga los valores iniciales del festivo', () => {
    renderWithQuery(
      <HolidayEditModal
        open={true}
        holiday={buildHoliday()}
        branchName="Sucursal Norte"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Domingo de Ramos')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-03-29')).toBeInTheDocument();
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument();
  });

  it('envia cambios y cierra al guardar', async () => {
    patchMock.mockResolvedValue({ data: {} });
    const onClose = vi.fn();

    renderWithQuery(
      <HolidayEditModal
        open={true}
        holiday={buildHoliday()}
        onClose={onClose}
      />,
    );

    const nameInput = screen.getByPlaceholderText('Nombre del festivo');
    fireEvent.change(nameInput, { target: { value: 'Nuevo nombre festivo' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/branches/branch-1/holidays/h-1', {
        name: 'Nuevo nombre festivo',
        date: '2026-03-29',
        type: 'regional',
      });
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Festivo actualizado');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

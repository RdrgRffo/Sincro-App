import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { HolidaysPage } from '@/pages/admin/HolidaysPage';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test.com',
        role: { name: 'admin' },
        branchId: 'b-1',
      },
    };
    return selector ? selector(state) : state;
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HolidaysPage />
    </QueryClientProvider>,
  );
}

describe('HolidaysPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('evita requests de festivos cuando no hay sucursales', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [],
      },
    });

    renderPage();

    expect(await screen.findByText('Sin sucursales')).toBeInTheDocument();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    expect(getMock.mock.calls[0]?.[0]).toBe('/branches');
    expect(getMock.mock.calls.some((call) => String(call[0]).includes('/holidays'))).toBe(false);
  });

  it('muestra validacion si faltan fecha o nombre', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'b-1',
                name: 'Madrid',
                code: 'MAD01',
                countryCode: 'ES',
                timezone: 'Europe/Madrid',
                isActive: true,
                createdAt: '',
                updatedAt: '',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });

    renderPage();

    // Abrir el modal de creación
    await userEvent.click(await screen.findByRole('button', { name: /Nuevo festivo/i }));

    // El modal hace su propia llamada a /branches
    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    // Hacer clic en "Crear festivo" sin rellenar campos
    await userEvent.click(await screen.findByRole('button', { name: /Crear festivo/i }));

    expect(toast.error).toHaveBeenCalledWith('Fecha y nombre son obligatorios');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('crea un festivo para la sucursal efectiva', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'b-1',
                name: 'Madrid',
                code: 'MAD01',
                countryCode: 'ES',
                timezone: 'Europe/Madrid',
                isActive: true,
                createdAt: '',
                updatedAt: '',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });
    postMock.mockResolvedValueOnce({ data: { success: true } });

    const { container } = renderPage();

    // Abrir el modal de creación
    await userEvent.click(await screen.findByRole('button', { name: /Nuevo festivo/i }));

    // Rellenar campos en el modal
    await userEvent.type(await screen.findByPlaceholderText('Nombre del festivo'), 'San Isidro');
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, '2026-05-15');

    // Enviar
    await userEvent.click(screen.getByRole('button', { name: /Crear festivo/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/branches/b-1/holidays', expect.objectContaining({ name: 'San Isidro' }));
      expect(toast.success).toHaveBeenCalledWith('Festivo creado');
    });
  });
});

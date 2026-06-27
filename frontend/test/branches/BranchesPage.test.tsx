import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import { BranchesPage } from '@/pages/admin/BranchesPage';

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
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test.com',
        role: { name: 'admin' },
        branchId: 'b-1',
      },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
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
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <BranchesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('BranchesPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('valida campos obligatorios al crear sucursal', async () => {
    getMock.mockResolvedValueOnce({
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

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Crear' }));

    expect(toast.error).toHaveBeenCalledWith('Nombre y código son obligatorios');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('crea sucursal normalizando codigo a mayusculas', async () => {
    getMock.mockResolvedValueOnce({
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
    postMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo' }));
    await userEvent.type(await screen.findByPlaceholderText('Nombre'), 'Valencia');
    await userEvent.type(screen.getByPlaceholderText('Código (ej: MAD01)'), 'vlc99');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/branches', expect.objectContaining({ name: 'Valencia', code: 'VLC99' }));
      expect(toast.success).toHaveBeenCalledWith('Sucursal creada');
    });
  });

  it('muestra la primera sucursal de la lista y sus acciones al entrar', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'b-1',
            name: 'Barcelona Centro',
            code: 'BCN01',
            address: 'Calle Mayor 1',
            city: 'Barcelona',
            region: 'Catalunya',
            countryCode: 'ES',
            timezone: 'Europe/Madrid',
            isActive: false,
            createdAt: '',
            updatedAt: '',
          },
          {
            id: 'b-2',
            name: 'Madrid Centro',
            code: 'MAD01',
            city: 'Madrid',
            region: 'Madrid',
            countryCode: 'ES',
            timezone: 'Europe/Madrid',
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Barcelona Centro' })).toBeInTheDocument();
    expect(screen.getByText('Calle Mayor 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Madrid Centro/i }));

    expect(await screen.findByRole('heading', { name: 'Madrid Centro' })).toBeInTheDocument();
  });

  it('muestra el select de zona horaria con opciones predefinidas', async () => {
    getMock.mockResolvedValueOnce({
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

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo' }));

    const timezoneSelect = screen.getByLabelText('Zona horaria *');
    expect(timezoneSelect).toBeInTheDocument();
    expect(timezoneSelect.tagName).toBe('SELECT');

    // Verificar que las opciones están disponibles
    const options = screen.getAllByRole('option');
    const optionValues = options.map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toContain('Europe/Madrid');
    expect(optionValues).toContain('Atlantic/Canary');

    // Verificar que el valor por defecto es Europe/Madrid
    expect((timezoneSelect as HTMLSelectElement).value).toBe('Europe/Madrid');

    // Cambiar a Atlantic/Canary
    await userEvent.selectOptions(timezoneSelect, 'Atlantic/Canary');
    expect((timezoneSelect as HTMLSelectElement).value).toBe('Atlantic/Canary');
  });

  it('permite activar una sucursal inactiva', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'b-1',
            name: 'Barcelona Centro',
            code: 'BCN01',
            countryCode: 'ES',
            timezone: 'Europe/Madrid',
            isActive: false,
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
    });
    patchMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Activar' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Activar' }))[1]);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/branches/b-1/reactivate');
      expect(toast.success).toHaveBeenCalledWith('Sucursal reactivada');
    });
  });

  it('recarga la lista incluyendo sucursales inactivas al activar el toggle', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'b-1',
            name: 'Madrid Centro',
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

    renderPage();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Mostrar inactivas' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/branches', { params: { includeInactive: true } });
    });
  });
});

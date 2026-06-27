import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage';

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
        <DepartmentsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('DepartmentsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('muestra el departamento inactivo seleccionado y permite reactivarlo', async () => {
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
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'd-1',
            name: 'Atención',
            code: 'ATEN',
            description: 'Atención al cliente',
            isActive: false,
            branches: [{ branch: { id: 'b-1', name: 'Madrid', code: 'MAD01', isActive: true } }],
            managers: [],
            _count: { users: 2 },
          },
        ],
      },
    });
    patchMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Atención/i }));
    expect(await screen.findByRole('heading', { name: 'Atención' })).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Activar' }))[1]);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/departments/d-1/reactivate');
      expect(toast.success).toHaveBeenCalledWith('Departamento reactivado');
    });
  });

  it('recarga los departamentos incluyendo inactivos al activar el toggle', async () => {
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
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'd-1',
            name: 'Atención',
            code: 'ATEN',
            description: 'Atención al cliente',
            isActive: false,
            branches: [{ branch: { id: 'b-1', name: 'Madrid', code: 'MAD01', isActive: true } }],
            managers: [],
            _count: { users: 2 },
          },
        ],
      },
    });

    renderPage();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Mostrar inactivos' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/departments', {
        params: { branchId: 'b-1', includeInactive: true },
      });
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UsersPage } from '@/pages/admin/UsersPage';

const getMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();
const postMock = vi.fn();

const authState: {
  user: {
    id: string;
    role: { name: 'admin' | 'general_manager' | 'department_manager' | 'employee' };
    branchId?: string;
    departmentId?: string | null;
    visibleBranches?: Array<{ branch: { id: string } }>;
  } | null;
} = {
  user: { id: 'admin-1', role: { name: 'admin' } },
};

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/pages/admin/UserFormModal', () => ({
  UserFormModal: () => null,
}));

vi.mock('@/pages/admin/ResetPasswordModal', () => ({
  ResetPasswordModal: () => null,
}));

vi.mock('@/pages/admin/UserDetailsModal', () => ({
  UserDetailsModal: () => null,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
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
        <UsersPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    postMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    authState.user = { id: 'admin-1', role: { name: 'admin' } };
  });

  it('muestra estado vacio cuando no hay usuarios', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: [],
        pagination: { total: 0, page: 1, limit: 15, totalPages: 1 },
      },
    });

    renderPage();

    expect(await screen.findByText('Sin usuarios')).toBeInTheDocument();
  });

  it('activa un usuario deshabilitado desde el menu de acciones', async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-1',
            name: 'Maria Admin',
            email: 'maria@test.dev',
            role: { name: 'employee' },
            status: 'disabled',
            department: { id: 'dept-1', name: 'Soporte', code: 'SOP' },
            branch: null,
            lastLoginAt: null,
          },
        ],
        pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
      },
    });
    patchMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    const userNameCell = await screen.findByText('Maria Admin');
    const row = userNameCell.closest('tr');
    const menuButton = row?.querySelector('button');
    expect(menuButton).toBeTruthy();
    await userEvent.click(menuButton as HTMLButtonElement);
    // Click "Activar" in the dropdown menu (which is likely not a button element)
    const activateButtons = await screen.findAllByText(/^Activar$/i);
    await userEvent.click(activateButtons[0]);

    // Click "Activar" in the confirmation dialog
    await userEvent.click(await screen.findByRole('button', { name: /^Activar$/i }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/users/u-1/status', { status: 'active' });
      expect(toast.success).toHaveBeenCalledWith('Estado actualizado');
    });
  });

  it('permite forzar cambio de contraseña desde acciones de usuario', async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-10',
            name: 'Pedro Manager',
            email: 'pedro@test.dev',
            role: { name: 'general_manager' },
            status: 'active',
            department: { id: 'dept-2', name: 'Operaciones', code: 'OPS' },
            branch: null,
            lastLoginAt: null,
          },
        ],
        pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
      },
    });
    postMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    const userNameCell = await screen.findByText('Pedro Manager');
    const row = userNameCell.closest('tr');
    const menuButton = row?.querySelector('button');
    expect(menuButton).toBeTruthy();

    await userEvent.click(menuButton as HTMLButtonElement);
    await userEvent.click(await screen.findByRole('button', { name: /Forzar cambio de contraseña/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/users/u-10/force-password-change');
      expect(toast.success).toHaveBeenCalledWith('Cambio de contraseña forzado');
    });
  });

  it('muestra departamento con inicial mayuscula en la tabla', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 'branch-1', code: 'TFN', name: 'Tenerife', isActive: true }],
          },
        });
      }

      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: 'u-2',
              name: 'Carlos Viewer',
              email: 'carlos@test.dev',
              role: { name: 'employee' },
              status: 'active',
              department: { id: 'dept-3', name: 'Seguridad', code: 'SEG' },
              branch: null,
              lastLoginAt: null,
            },
          ],
          pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
        },
      });
    });

    renderPage();

    expect(await screen.findByText('Seguridad')).toBeInTheDocument();
  });

  it('procesa la importacion de un archivo CSV', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 'branch-1', code: 'TFN', name: 'Tenerife', isActive: true }],
          },
        });
      }

      return Promise.resolve({
        data: {
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 15, totalPages: 1 },
        },
      });
    });
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: { created: 1, updated: 2, unchanged: 0, failed: 0, rejectedRows: [] },
      },
    });

    renderPage();

    const file = new File(['employeeId,name,email,role,status,department,branchId,companyPhone,auxiliaryPhone\nLAB-200,Juan,juan@test.com,employee,active,,TFN,,'], 'users.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-upload-input') as HTMLInputElement;
    
    // El input está hidden, pero podemos interactuar con él si lo encontramos
    expect(input).toBeTruthy();
    
    await userEvent.upload(input!, file);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Importación completada'));
    });
  });

  it.each([
    { label: 'punto y coma', delimiter: ';' },
    { label: 'tab', delimiter: '\t' },
    { label: 'pipe', delimiter: '|' },
  ])('procesa importacion CSV con delimitador $label', async ({ delimiter }) => {
    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 'branch-1', code: 'TFN', name: 'Tenerife', isActive: true }],
          },
        });
      }

      return Promise.resolve({
        data: {
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 15, totalPages: 1 },
        },
      });
    });
    postMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: { created: 1, updated: 0, unchanged: 0, failed: 0, rejectedRows: [] },
      },
    });

    renderPage();

    const headers = ['employeeId', 'name', 'email', 'role', 'status', 'department', 'branchId', 'companyPhone', 'auxiliaryPhone'].join(delimiter);
    const row = ['LAB-201', 'Juana', 'juana@test.com', 'employee', 'active', '', 'TFN', '', ''].join(delimiter);
    const file = new File([`${headers}\n${row}`], 'users-alt-delimiter.csv', { type: 'text/csv' });
    const input = screen.getByTestId('csv-upload-input') as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('Faltan columnas obligatorias'));
    });
  });

  it('envia sortBy y sortOrder al cambiar orden desde cabecera', async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-3',
            name: 'Ana Viewer',
            email: 'ana@test.dev',
            role: { name: 'employee' },
            status: 'active',
            department: { id: 'dept-3', name: 'Seguridad', code: 'SEG' },
            branch: null,
            lastLoginAt: null,
          },
        ],
        pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
      },
    });

    renderPage();

    await screen.findByText('Ana Viewer');
    await userEvent.click(screen.getByRole('button', { name: 'Usuario' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/users', expect.objectContaining({
        params: expect.objectContaining({
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      }));
    });
  });


  it('envia filtros configurados al backend al cambiar rol', async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'u-4',
            name: 'Luis Admin',
            email: 'luis@test.dev',
            role: { name: 'admin' },
            status: 'active',
            department: { id: 'dept-4', name: 'Administración', code: 'ADM' },
            branch: null,
            lastLoginAt: null,
          },
        ],
        pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
      },
    });

    renderPage();

    await screen.findByText('Luis Admin');
    await userEvent.selectOptions(screen.getByDisplayValue('Todos los roles'), 'general_manager');

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/users', expect.objectContaining({
        params: expect.objectContaining({
          role: 'general_manager',
        }),
      }));
    });
  });

  it('muestra usuarios de toda la branch para DM pero oculta editar fuera de su departamento', async () => {
    authState.user = {
      id: 'dm-1',
      role: { name: 'department_manager' },
      branchId: 'branch-1',
      departmentId: 'dept-a',
    };

    getMock.mockImplementation((url: string) => {
      if (url === '/branches') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ id: 'branch-1', code: 'TFN', name: 'Tenerife', isActive: true }],
          },
        });
      }

      if (url === '/departments') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              { id: 'dept-a', name: 'Operaciones', code: 'OPS', isActive: true },
              { id: 'dept-b', name: 'Soporte', code: 'SUP', isActive: true },
            ],
          },
        });
      }

      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: 'u-1',
              name: 'Usuario Soporte',
              email: 'soporte@test.dev',
              role: { name: 'employee' },
              status: 'active',
              department: { id: 'dept-b', name: 'Soporte', code: 'SUP' },
              branch: { id: 'branch-1', name: 'Tenerife', code: 'TFN' },
              lastLoginAt: null,
            },
          ],
          pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
        },
      });
    });

    renderPage();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/users', expect.objectContaining({
        params: expect.objectContaining({ branchId: 'branch-1', departmentId: undefined }),
      }));
    });

    const row = await screen.findByText('Usuario Soporte');
    const menuButton = row.closest('tr')?.querySelector('button');
    expect(menuButton).toBeTruthy();

    await userEvent.click(menuButton as HTMLButtonElement);

    expect(screen.getByText('Ver detalle')).toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
  });
});

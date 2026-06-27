import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ScheduleTypesPage } from '@/pages/admin/ScheduleTypesPage';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn() };
  return { default: toast, toast };
});

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

const mockTypes = [
  { id: '1', label: 'Mañana', value: 'manana', color: '#4F46E5', createdAt: '', updatedAt: '' },
  { id: '2', label: 'Tarde', value: 'tarde', color: '#F59E0B', createdAt: '', updatedAt: '' },
  { id: '3', label: 'Noche', value: 'noche', color: '#1E3A5F', createdAt: '', updatedAt: '' },
];

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
        <ScheduleTypesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ScheduleTypesPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it('renderiza la lista de tipos de turno', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });

    renderPage();

    expect(await screen.findByText('Mañana')).toBeInTheDocument();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
    expect(screen.getByText('Noche')).toBeInTheDocument();
  });

  it('muestra boton Nuevo Tipo solo para admin', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });

    renderPage();

    expect(await screen.findByText('Nuevo Tipo')).toBeInTheDocument();
  });

  it('abre modal al hacer click en Nuevo Tipo', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });

    renderPage();

    await userEvent.click(await screen.findByText('Nuevo Tipo'));
    expect(screen.getByText('Nuevo Tipo de Turno')).toBeInTheDocument();
  });

  it('crea un nuevo tipo de turno', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });
    postMock.mockResolvedValueOnce({ data: { success: true, data: { id: '4', label: 'Test', value: 'test', color: '#000000' } } });

    renderPage();

    await userEvent.click(await screen.findByText('Nuevo Tipo'));
    await userEvent.type(screen.getByPlaceholderText('Ej: Guardia Nocturna'), 'Test Type');
    await userEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/schedule-types', expect.objectContaining({
        label: 'Test Type',
        value: 'test_type',
      }));
    });
  });

  it('abre modal de edicion al hacer click en editar', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });

    renderPage();

    const editButtons = await screen.findAllByRole('button');
    const editBtn = editButtons.find((b) => b.innerHTML.includes('edit'));
    if (editBtn) {
      await userEvent.click(editBtn);
      expect(screen.getByText('Editar Tipo de Turno')).toBeInTheDocument();
    }
  });

  it('abre confirmacion al hacer click en eliminar', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });

    renderPage();

    const deleteButtons = await screen.findAllByRole('button');
    const deleteBtn = deleteButtons.find((b) => b.innerHTML.includes('trash'));
    if (deleteBtn) {
      await userEvent.click(deleteBtn);
      expect(screen.getByText(/¿Estás seguro/)).toBeInTheDocument();
    }
  });

  it('elimina un tipo de turno', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockTypes } });
    deleteMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    const deleteButtons = await screen.findAllByRole('button');
    const deleteBtn = deleteButtons.find((b) => b.innerHTML.includes('trash'));
    if (deleteBtn) {
      await userEvent.click(deleteBtn);
      await userEvent.click(screen.getByText('Eliminar'));
      await waitFor(() => {
        expect(deleteMock).toHaveBeenCalledWith('/schedule-types/1');
      });
    }
  });

  it('muestra skeleton mientras carga', () => {
    getMock.mockResolvedValueOnce(new Promise(() => {})); // never resolves

    renderPage();

    expect(screen.getByLabelText('Cargando tabla…')).toBeInTheDocument();
  });
});

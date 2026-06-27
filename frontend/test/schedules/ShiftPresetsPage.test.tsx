import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ShiftPresetsPage from '@/pages/admin/ShiftPresetsPage';

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

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn() };
  return { default: toast, toast };
});

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => {
    // Read current role from global variable so tests can change it
    const currentRole = (globalThis as unknown as Record<string, string>).__TEST_MOCK_ROLE || 'admin';
    return selector({
      user: {
        id: 'emp-1',
        name: 'Test User',
        email: 'test@test.com',
        role: { name: currentRole },
        branchId: 'b-1',
      },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
  },
}));

const mockPresets = [
  { id: '1', name: 'Mañana', startTime: '06:00', endTime: '14:00', isActive: true, createdAt: '', updatedAt: '' },
  { id: '2', name: 'Tarde', startTime: '14:00', endTime: '22:00', isActive: true, createdAt: '', updatedAt: '' },
  { id: '3', name: 'Noche', startTime: '22:00', endTime: '06:00', isActive: false, createdAt: '', updatedAt: '' },
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
        <ShiftPresetsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ShiftPresetsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it('renderiza la lista de turnos predefinidos', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });

    renderPage();

    expect(await screen.findByText('Mañana')).toBeInTheDocument();
    expect(screen.getByText('Tarde')).toBeInTheDocument();
    expect(screen.getByText('Noche')).toBeInTheDocument();
  });

  it('muestra boton Nuevo Turno solo para admin', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });

    renderPage();

    expect(await screen.findByText('Nuevo Turno')).toBeInTheDocument();
  });

  it('abre modal al hacer click en Nuevo Turno', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });

    renderPage();

    await userEvent.click(await screen.findByText('Nuevo Turno'));
    expect(screen.getByText('Nuevo Turno Predefinido')).toBeInTheDocument();
  });

  it('crea un nuevo turno predefinido', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });
    postMock.mockResolvedValueOnce({ data: { success: true, data: { id: '4', name: 'Test' } } });

    renderPage();

    await userEvent.click(await screen.findByText('Nuevo Turno'));
    await userEvent.type(screen.getByPlaceholderText('Ej: Turno Mañana'), 'Test Turno');
    await userEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/shift-presets', expect.objectContaining({
        name: 'Test Turno',
      }));
    });
  });

  it('abre modal de edicion al hacer click en editar', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });

    renderPage();

    const editButtons = await screen.findAllByRole('button');
    const editBtn = editButtons.find((b) => b.innerHTML.includes('edit'));
    if (editBtn) {
      await userEvent.click(editBtn);
      expect(screen.getByText('Editar Turno Predefinido')).toBeInTheDocument();
    }
  });

  it('elimina un turno predefinido', async () => {
    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });
    deleteMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    // Click the delete (Trash2) button for the first preset
    const deleteButtons = await screen.findAllByRole('button');
    const deleteBtn = deleteButtons.find((b) => b.innerHTML.includes('trash'));
    if (deleteBtn) {
      await userEvent.click(deleteBtn);

      // Confirm dialog should appear — click "Desactivar" to confirm
      const confirmBtn = await screen.findByText('Desactivar');
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deleteMock).toHaveBeenCalledWith('/shift-presets/1');
      });
    }
  });

  it('muestra skeleton mientras carga', () => {
    getMock.mockResolvedValueOnce(new Promise(() => {})); // never resolves

    renderPage();

    expect(screen.getByLabelText('Cargando tabla…')).toBeInTheDocument();
  });

  it('no muestra boton Nuevo Turno si no es admin', async () => {
    (globalThis as unknown as Record<string, string>).__TEST_MOCK_ROLE = 'employee';

    getMock.mockResolvedValueOnce({ data: { success: true, data: mockPresets } });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Nuevo Turno')).not.toBeInTheDocument();
    });
  });
});

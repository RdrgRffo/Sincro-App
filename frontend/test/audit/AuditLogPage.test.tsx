import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuditLogPage } from '@/pages/admin/AuditLogPage';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/audit/ActivityDetail', () => ({
  ActivityDetail: () => <div>Detalle cargado</div>,
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
        <AuditLogPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('carga ambas pestañas de auditoria por defecto', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/audit') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'a-1',
                action: 'UPDATE_USER',
                entityType: 'User',
                entityId: 'u-1',
                createdAt: '2026-04-20T08:00:00.000Z',
                detailsJson: { before: { name: 'Old' }, after: { name: 'New' } },
                user: { id: 'admin-1', name: 'Admin', email: 'admin@test.dev' },
              },
            ],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: null } });
    });

    renderPage();

    expect(await screen.findByText('Acciones de Datos')).toBeInTheDocument();
    expect(screen.getByText('Eventos de Seguridad')).toBeInTheDocument();
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/audit', expect.objectContaining({ params: expect.objectContaining({ reversible: 'true' }) }));
      expect(getMock).toHaveBeenCalledWith('/audit', expect.objectContaining({ params: expect.objectContaining({ reversible: 'false' }) }));
    });
  });

  it('permite revertir un registro reversible', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/audit') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'a-1',
                action: 'UPDATE_USER',
                entityType: 'User',
                entityId: 'u-1',
                createdAt: '2026-04-20T08:00:00.000Z',
                detailsJson: { before: { name: 'Old' }, after: { name: 'New' } },
                user: { id: 'admin-1', name: 'Admin', email: 'admin@test.dev' },
              },
            ],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        });
      }

      if (url === '/audit/a-1') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 'a-1',
              action: 'UPDATE_USER',
              entityType: 'User',
              entityId: 'u-1',
              createdAt: '2026-04-20T08:00:00.000Z',
              detailsJson: { before: { name: 'Old' }, after: { name: 'New' } },
              user: { id: 'admin-1', name: 'Admin', email: 'admin@test.dev' },
            },
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: [] } });
    });
    postMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    await userEvent.click(await screen.findByText('UPDATE USER'));
    await userEvent.click(await screen.findByRole('button', { name: 'Revertir cambio' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/audit/a-1/rollback');
      expect(toast.success).toHaveBeenCalledWith('Cambio revertido correctamente');
    });
  });

  it('envia sortBy y sortOrder al ordenar por accion', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/audit') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'a-2',
                action: 'CREATE_USER',
                entityType: 'User',
                entityId: 'u-2',
                createdAt: '2026-04-20T08:00:00.000Z',
                detailsJson: { before: null, after: { name: 'New User' } },
                user: { id: 'admin-1', name: 'Admin', email: 'admin@test.dev' },
              },
            ],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: null } });
    });

    renderPage();

    await screen.findByText('CREATE USER');
    await userEvent.click(screen.getByRole('button', { name: 'Acción' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/audit', expect.objectContaining({
        params: expect.objectContaining({
          sortBy: 'action',
          sortOrder: 'asc',
        }),
      }));
    });
  });

  it('envia filtros configurados al backend al cambiar tipo de entidad', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/audit') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'a-3',
                action: 'UPDATE_SCHEDULE',
                entityType: 'Schedule',
                entityId: 's-1',
                createdAt: '2026-04-20T08:00:00.000Z',
                detailsJson: { before: { id: 's-1' }, after: { id: 's-1' } },
                user: { id: 'admin-1', name: 'Admin', email: 'admin@test.dev' },
              },
            ],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        });
      }

      return Promise.resolve({ data: { success: true, data: null } });
    });

    renderPage();

    await screen.findByText('UPDATE SCHEDULE');
    await userEvent.selectOptions(screen.getByDisplayValue('Todos los tipos'), 'Schedule');

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/audit', expect.objectContaining({
        params: expect.objectContaining({
          entityType: 'Schedule',
        }),
      }));
    });
  });
});

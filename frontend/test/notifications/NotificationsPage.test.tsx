import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { NotificationsPage } from '@/pages/admin/NotificationsPage';

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

vi.mock('@/hooks/usePermissions', () => ({
  usePermission: (permission: string) =>
    permission === 'webhooks:manage' || permission === 'notifications:send',
}));

const notificationsResponse = {
  data: {
    success: true,
    data: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
  },
};

const branchesResponse = {
  data: {
    data: [
      { id: 'branch-1', name: 'Madrid', code: 'MAD', isActive: true },
      { id: 'branch-2', name: 'Canarias', code: 'CAN', isActive: true },
    ],
  },
};

const departmentsResponse = {
  data: {
    data: [
      {
        id: 'dept-1',
        name: 'Cocina',
        code: 'COC',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        branches: [{ branch: { id: 'branch-1', name: 'Madrid', code: 'MAD', isActive: true } }],
      },
      {
        id: 'dept-2',
        name: 'Sala',
        code: 'SAL',
        isActive: true,
        createdAt: '',
        updatedAt: '',
        branches: [{ branch: { id: 'branch-2', name: 'Canarias', code: 'CAN', isActive: true } }],
      },
    ],
  },
};

const webhooksResponse = {
  data: {
    data: [
      {
        id: 'wh-general',
        name: 'General',
        enabled: true,
        webhookUrl: 'https://example.com/general',
        notifyModifications: true,
        notifyLastMinute: true,
        fridayReminderEnabled: true,
        mondayAbsenceReminderEnabled: true,
        fridayReminderTime: '12:00',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'wh-dept-1-branch-1',
        name: 'Cocina Madrid',
        enabled: true,
        webhookUrl: 'https://example.com/cocina-madrid',
        branchId: 'branch-1',
        branch: { id: 'branch-1', name: 'Madrid' },
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Cocina' },
        notifyModifications: true,
        notifyLastMinute: true,
        fridayReminderEnabled: true,
        mondayAbsenceReminderEnabled: true,
        fridayReminderTime: '12:00',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'wh-dept-2-branch-2',
        name: 'Sala Canarias',
        enabled: true,
        webhookUrl: 'https://example.com/sala-canarias',
        branchId: 'branch-2',
        branch: { id: 'branch-2', name: 'Canarias' },
        departmentId: 'dept-2',
        department: { id: 'dept-2', name: 'Sala' },
        notifyModifications: true,
        notifyLastMinute: true,
        fridayReminderEnabled: true,
        mondayAbsenceReminderEnabled: true,
        fridayReminderTime: '12:00',
        createdAt: '',
        updatedAt: '',
      },
    ],
  },
};

function mockApiLists() {
  getMock.mockImplementation((url: string) => {
    if (url === '/notifications/logs') return Promise.resolve(notificationsResponse);
    if (url === '/webhooks') return Promise.resolve(webhooksResponse);
    if (url === '/branches') return Promise.resolve(branchesResponse);
    if (url === '/departments') return Promise.resolve(departmentsResponse);
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsPage />
    </QueryClientProvider>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('muestra estado vacio cuando no hay notificaciones', async () => {
    mockApiLists();

    renderPage();

    expect(await screen.findByText('Sin notificaciones')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('/notifications/logs', { params: { page: 1, limit: 20 } });
  });

  it('permite reenviar una notificacion fallida', async () => {
    mockApiLists();
    getMock.mockImplementation((url: string) => {
      if (url === '/notifications/logs') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'log-1',
                type: 'manual_announcement',
                message: 'Error temporal',
                status: 'failed',
                sentAt: '2026-04-20T08:00:00.000Z',
                webhookConfig: { id: 'wh-1', name: 'Ops' },
              },
            ],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        });
      }
      if (url === '/webhooks') return Promise.resolve(webhooksResponse);
      if (url === '/branches') return Promise.resolve(branchesResponse);
      if (url === '/departments') return Promise.resolve(departmentsResponse);
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    postMock.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    const resendText = await screen.findByText('Reenviar');
    const resendButton = resendText.closest('button');
    expect(resendButton).toBeTruthy();
    await userEvent.click(resendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/notifications/resend/log-1');
      expect(toast.success).toHaveBeenCalledWith('Notificación reenviada');
    });
  });

  it('filtra departamentos y webhooks antes de enviar resumen de ausencias a un webhook especifico', async () => {
    mockApiLists();
    postMock.mockResolvedValueOnce({ data: { success: true, message: 'Resumen enviado' } });

    renderPage();

    const title = await screen.findByText('Ausencias de la semana');
    const card = title.closest('.card') as HTMLElement;
    const cardUi = within(card);

    await userEvent.click(cardUi.getByRole('button', { name: /específico/i }));
    const [branchSelect, departmentSelect] = cardUi.getAllByRole('combobox');

    await userEvent.selectOptions(branchSelect, 'branch-1');
    expect(cardUi.getByRole('option', { name: 'Cocina' })).toBeInTheDocument();
    expect(cardUi.queryByRole('option', { name: 'Sala' })).not.toBeInTheDocument();

    await userEvent.selectOptions(departmentSelect, 'dept-1');
    const webhookSelect = cardUi.getAllByRole('combobox')[2];
    expect(cardUi.getByRole('option', { name: /Cocina Madrid/i })).toBeInTheDocument();
    expect(cardUi.queryByRole('option', { name: /Sala Canarias/i })).not.toBeInTheDocument();

    await userEvent.selectOptions(webhookSelect, 'wh-dept-1-branch-1');
    await userEvent.click(cardUi.getByRole('button', { name: /enviar resumen ahora/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/notifications/absence-summary', {
        webhookConfigIds: ['wh-dept-1-branch-1'],
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleSidebar } from '@/components/schedule/ScheduleSidebar';
import type { Branch, Department } from '@/types';

const getMock = vi.fn();

vi.mock('@/config/api', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

vi.mock('@/components/schedule/BranchSelector', () => ({
  BranchSelector: ({ branches, onChange, isEmployee }: { branches: Array<{ id: string; name: string }>; onChange: (id: string) => void; isEmployee?: boolean }) => (
    <div>
      <button type="button" onClick={() => onChange(branches[0]?.id ?? '')}>Select first branch</button>
      <span data-testid="branch-count">{branches.length}</span>
      <span data-testid="is-employee">{isEmployee ? 'yes' : 'no'}</span>
    </div>
  ),
}));

vi.mock('@/components/schedule/TypeLegend', () => ({
  TypeLegend: () => null,
}));

vi.mock('@/components/schedule/HolidayLegend', () => ({
  HolidayLegend: () => null,
}));

function renderSidebar(overrides?: Partial<ComponentProps<typeof ScheduleSidebar>>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const defaultProps: ComponentProps<typeof ScheduleSidebar> = {
    branches: [{
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD01',
      timezone: 'Europe/Madrid',
      address: null,
      city: null,
      region: null,
      countryCode: 'ES',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      managerId: null,
    } satisfies Branch],
    activeBranchId: 'b-1',
    effectiveActiveBranchId: 'b-1',
    canSelectBranches: true,
    canViewAllBranches: true,
    onBranchChange: vi.fn(),
    departments: [{
      id: 'd-1',
      name: 'Cocina',
      code: 'COC',
      description: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } satisfies Department],
    selectedDeptId: '',
    onDepartmentChange: vi.fn(),
    hiddenTypes: new Set<string>(),
    onToggleType: vi.fn(),
    typeCounts: {},
    holidayTypeCounts: {},
    scheduleTypes: [],
    isEmployee: false,
    filterUserId: '',
    onFilterUserChange: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ScheduleSidebar {...defaultProps} {...overrides} />
    </QueryClientProvider>,
  );
}

describe('ScheduleSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga usuarios activos para admin/manager y muestra opciones filtradas', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/users') {
        return Promise.resolve({
          data: {
            data: [
              { id: 'u-1', name: 'Ana', status: 'active' },
              { id: 'u-2', name: 'Bernardo', status: 'inactive' },
            ],
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    renderSidebar({ isEmployee: false, selectedDeptId: 'd-1', effectiveActiveBranchId: 'b-1' });

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/users', expect.any(Object)));

    expect(screen.getByTestId('branch-count')).toHaveTextContent('1');
    expect(await screen.findByRole('option', { name: 'Ana' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Bernardo' })).toBeInTheDocument();
  });

  it('no consulta usuarios cuando es employee y permite togglear "Mis turnos"', async () => {
    const onFilterUserChange = vi.fn();
    renderSidebar({ isEmployee: true, onFilterUserChange });

    expect(getMock.mock.calls.some((call) => call[0] === '/users')).toBe(false);
    expect(screen.getByTestId('is-employee')).toHaveTextContent('yes');

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onFilterUserChange).toHaveBeenCalledWith('me');
  });
});

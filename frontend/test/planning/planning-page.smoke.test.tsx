import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlanningPage } from '@/pages/admin/PlanningPage';

// ── Auth ─────────────────────────────────────────────────────────────────────
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: null }) => unknown) => sel({ user: null }),
}));

// ── usePlanning hooks ─────────────────────────────────────────────────────────
vi.mock('@/hooks/usePlanning', () => ({
  usePlanningLookups: () => ({ data: { branches: [], departments: [], skills: [] } }),
  useCoverageRisks: () => ({ data: [] }),
  useAvailability: () => ({ data: [] }),
  useAvailabilityPaginated: () => ({ data: { pages: [{ data: [] }] }, isFetchingNextPage: false, hasNextPage: false, fetchNextPage: vi.fn(), isLoading: false }),
  useSubstitutes: () => ({ data: [] }),
  useAvailabilityMatrix: () => ({ data: undefined }),
  useEquity: () => ({ data: [] }),
  useTimeline: () => ({ data: [] }),
  useCrisisMode: () => ({
    data: {
      highRisks: [
        {
          severity: 'high',
          reasons: ['Cobertura insuficiente'],
          schedule: {
            id: '1',
            title: 'Riesgo test',
            startDatetime: new Date().toISOString(),
            endDatetime: new Date().toISOString(),
            branch: null,
          },
        },
      ],
      mediumRisks: [],
      overloaded: [],
    },
  }),
  useTemplatePreview: () => ({ data: [] }),
  useNotificationPreferences: () => ({ data: null }),
  useUpdateNotificationPreferences: () => ({ mutate: vi.fn() }),
}));

// ── Sub-components: mocked with data-testid so the test verifies composition ──
vi.mock('@/components/planning/PlanningFilters', () => ({
  PlanningFilters: () => <div data-testid="planning-filters" />,
}));

vi.mock('@/components/planning/PlanningSummaryCards', () => ({
  PlanningSummaryCards: () => <div data-testid="planning-summary-cards" />,
}));

vi.mock('@/components/planning/PlanningMatrix', () => ({
  PlanningMatrix: () => <div data-testid="planning-matrix" />,
}));

vi.mock('@/components/planning/PlanningSidePanels', () => ({
  PlanningSidePanels: () => <div data-testid="planning-side-panels" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PlanningPage smoke', () => {
  it('composes all planning sub-components', () => {
    render(<PlanningPage />, { wrapper });

    // All 4 sub-components must be rendered (verifies composition architecture)
    expect(screen.getByTestId('planning-filters')).toBeInTheDocument();
    expect(screen.getByTestId('planning-summary-cards')).toBeInTheDocument();
    expect(screen.getByTestId('planning-matrix')).toBeInTheDocument();
    expect(screen.getByTestId('planning-side-panels')).toBeInTheDocument();
  });

  it('renders inline sections that have no dedicated sub-component', () => {
    render(<PlanningPage />, { wrapper });

    // Notification preferences and availability matrix are inline (no sub-component)
    expect(screen.getByText('Mis avisos')).toBeInTheDocument();
    expect(screen.getByText('Mapa de disponibilidad')).toBeInTheDocument();
  });
});

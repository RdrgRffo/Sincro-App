/**
 * @file Skeleton.test.tsx
 * Tests de componentes Skeleton.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  DashboardSkeleton,
  ScheduleSkeleton,
  TableSkeleton,
  ProfileSkeleton,
  AbsencesSkeleton,
  DetailPageSkeleton,
  ListPageSkeleton,
  SettingsPageSkeleton,
} from '@/components/common/Skeleton';

describe('Skeleton base', () => {
  it('renderiza con clase animate-pulse', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('aplica className adicional', () => {
    const { container } = render(<Skeleton className="h-8 w-64" />);
    expect(container.firstChild).toHaveClass('h-8');
    expect(container.firstChild).toHaveClass('w-64');
  });

  it('tiene aria-hidden', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('DashboardSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<DashboardSkeleton />);
    expect(screen.getByLabelText('Cargando dashboard…')).toBeInTheDocument();
  });
});

describe('ScheduleSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<ScheduleSkeleton />);
    expect(screen.getByLabelText('Cargando calendario…')).toBeInTheDocument();
  });
});

describe('TableSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<TableSkeleton />);
    expect(screen.getByLabelText('Cargando tabla…')).toBeInTheDocument();
  });

  it('renderiza número personalizado de filas', () => {
    const { container } = render(<TableSkeleton rows={3} cols={2} />);
    // Debe haber 3 filas de skeleton
    const rows = container.querySelectorAll('.border-t');
    expect(rows).toHaveLength(3);
  });
});

describe('ProfileSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<ProfileSkeleton />);
    expect(screen.getByLabelText('Cargando perfil…')).toBeInTheDocument();
  });
});

describe('AbsencesSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<AbsencesSkeleton />);
    expect(screen.getByLabelText('Cargando ausencias…')).toBeInTheDocument();
  });
});

describe('DetailPageSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<DetailPageSkeleton />);
    expect(screen.getByLabelText('Cargando página…')).toBeInTheDocument();
  });
});

describe('ListPageSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<ListPageSkeleton />);
    expect(screen.getByLabelText('Cargando listado…')).toBeInTheDocument();
  });
});

describe('SettingsPageSkeleton', () => {
  it('renderiza con aria-label', () => {
    render(<SettingsPageSkeleton />);
    expect(screen.getByLabelText('Cargando configuración…')).toBeInTheDocument();
  });
});

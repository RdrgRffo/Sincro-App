import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton base — un rectángulo animado con shimmer.
 * Úsalo como building block para crear skeletons más complejos.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200/60',
        className,
      )}
      aria-hidden="true"
    />
  );
}

/* ─── Skeletons específicos para páginas ─────────────────────── */

/** Para la página de Dashboard */
export function DashboardSkeleton() {
  return (
    <div className="space-y-7 animate-fade-in" aria-label="Cargando dashboard…">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-gray-100 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="lg:col-span-1 rounded-xl border border-gray-100 p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      {/* Weekly summary */}
      <div className="rounded-xl border border-gray-100 p-5 space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

/** Para la página de Schedule (calendario) */
export function ScheduleSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in" aria-label="Cargando calendario…">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-[600px] w-full rounded-xl" />
    </div>
  );
}

/** Para páginas de administración con tabla */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4 animate-fade-in" aria-label="Cargando tabla…">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Table header */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border-t border-gray-50 px-4 py-3 flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center">
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>
    </div>
  );
}

/** Para la página de perfil */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-label="Cargando perfil…">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Para la página de ausencias */
export function AbsencesSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in" aria-label="Cargando ausencias…">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="rounded-xl border border-gray-100 p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

/** Para páginas de administración con detalle (branches, departments) */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in" aria-label="Cargando página…">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="rounded-xl border border-gray-100 p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Para páginas de listado con filtros (holidays, webhooks, notifications, audit) */
export function ListPageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in" aria-label="Cargando listado…">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-t border-gray-50 px-4 py-3 flex gap-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Para páginas de configuración/tema */
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in" aria-label="Cargando configuración…">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-100 p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-gray-100 p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Para la página de planificación — skeleton por secciones */
export function PlanningSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in" aria-label="Cargando planificación…">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Scope indicator */}
      <Skeleton className="h-4 w-72" />

      {/* Filters row */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Crisis + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-gray-100 p-4 space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 p-4 space-y-3 lg:col-span-2">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-6 rounded" />
            <Skeleton className="h-6 rounded" />
            <Skeleton className="h-6 rounded" />
          </div>
        </div>
      </div>

      {/* Availability section */}
      <div className="rounded-xl border border-gray-100 p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix section */}
      <div className="rounded-xl border border-gray-100 p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="rounded-xl border border-gray-100 p-4 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <div className="rounded-xl border border-gray-100 p-4 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
        <div className="rounded-xl border border-gray-100 p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

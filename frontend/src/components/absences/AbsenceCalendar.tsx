import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventContentArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import { useAbsenceCalendarRange } from '@/hooks/useAbsences';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { CalendarDays } from 'lucide-react';
import type { Branch, Department } from '@/types';

const DEPARTMENT_PALETTE = [
  '#1d4ed8', '#0f766e', '#b45309', '#7c3aed', '#be185d',
  '#0ea5e9', '#16a34a', '#ea580c', '#334155', '#0891b2',
];

const MIXED_DEPARTMENT = 'Mixto';
const UNKNOWN_DEPARTMENT = 'Sin departamento';

function toLocalDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addOneDay(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function AbsenceEventContent({ info }: { info: EventContentArg }) {
  const departmentLabel = info.event.extendedProps.departmentLabel as string | undefined;
  const departmentColor = info.event.extendedProps.departmentColor as string | undefined;
  const isListView = info.view.type.startsWith('list');

  if (isListView) {
    return (
      <div className="google-list-event">
        <span className="google-list-event-dot" style={{ backgroundColor: departmentColor }} />
        <div className="google-list-event-main">
          <span className="google-list-event-title">{info.event.title}</span>
          {departmentLabel && (
            <span className="google-list-event-time">{departmentLabel}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absence-bar" style={{ color: '#ffffff' }}>
      <span className="absence-bar-title">{info.event.title}</span>
      {departmentLabel && <span className="absence-bar-dept">{departmentLabel}</span>}
    </div>
  );
}

interface Props {
  branches: Branch[];
  departments: Department[];
  selectedBranchId: string;
  selectedDepartmentId: string;
  onBranchChange: (branchId: string) => void;
  onDepartmentChange: (departmentId: string) => void;
  isAdmin: boolean;
  /** true si el usuario tiene más de una sede visible (además de admin). */
  canSelectBranch: boolean;
  isEmployee: boolean;
  userBranchId?: string | null;
  onAbsenceIdSelect?: (absenceId: string) => void;
}

export function AbsenceCalendar({
  branches,
  departments,
  selectedBranchId,
  selectedDepartmentId,
  onBranchChange,
  onDepartmentChange,
  isAdmin,
  canSelectBranch,
  isEmployee,
  userBranchId,
  onAbsenceIdSelect,
}: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  });

  const effectiveBranchId = useMemo(() => {
    if (isAdmin) return selectedBranchId;
    if (!userBranchId) return '';
    if (!canSelectBranch) return userBranchId;
    return selectedBranchId || userBranchId;
  }, [isAdmin, canSelectBranch, selectedBranchId, userBranchId]);

  const branchSelectValue = isAdmin ? effectiveBranchId : canSelectBranch ? (selectedBranchId || userBranchId || '') : '';

  const { data: calendarData, isLoading } = useAbsenceCalendarRange(
    dateRange.from,
    dateRange.to,
    {
      branchId: effectiveBranchId || undefined,
      departmentId: selectedDepartmentId || undefined,
    },
    true,
  );

  const absenceItems = useMemo(() => calendarData?.items ?? [], [calendarData?.items]);

  const departmentLabels = useMemo(() => {
    const base = new Set<string>();
    const hasMixed = false;
    let hasUnknown = false;

    absenceItems.forEach((item) => {
      const label = item.employeeDepartment?.name?.trim();
      if (!label) {
        hasUnknown = true;
      } else {
        base.add(label);
      }
    });

    const sorted = Array.from(base).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    if (hasMixed) sorted.push(MIXED_DEPARTMENT);
    if (hasUnknown) sorted.push(UNKNOWN_DEPARTMENT);
    return sorted;
  }, [absenceItems]);

  const departmentColors = useMemo(() => {
    const map: Record<string, string> = {
      [MIXED_DEPARTMENT]: '#64748b',
      [UNKNOWN_DEPARTMENT]: '#94a3b8',
    };

    let paletteIndex = 0;
    departmentLabels.forEach((label) => {
      if (map[label]) return;
      map[label] = DEPARTMENT_PALETTE[paletteIndex % DEPARTMENT_PALETTE.length];
      paletteIndex += 1;
    });

    return map;
  }, [departmentLabels]);

  const absenceEvents = useMemo(() => {
    return absenceItems.map((item) => {
      const departmentLabel = item.employeeDepartment?.name || UNKNOWN_DEPARTMENT;
      const departmentColor = departmentColors[departmentLabel] ?? '#64748b';
      const title = item.employeeName;
      const start = toLocalDateOnly(item.startDate);
      const end = addOneDay(toLocalDateOnly(item.endDate));

      return {
        id: `abs-${item.id}`,
        title,
        start,
        end,
        allDay: true,
        backgroundColor: departmentColor,
        borderColor: departmentColor,
        textColor: '#ffffff',
        extendedProps: {
          isAbsence: true,
          absenceId: item.id,
          departmentLabel,
          departmentColor,
        },
      };
    });
  }, [absenceItems, departmentColors]);

  const reflowCalendar = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.updateSize();
  }, []);

  useEffect(() => {
    if (!calendarContainerRef.current || typeof ResizeObserver === 'undefined') return;

    let rafId: number | null = null;
    const scheduleReflow = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        reflowCalendar();
      });
    };

    const observer = new ResizeObserver(() => {
      scheduleReflow();
    });

    observer.observe(calendarContainerRef.current);
    window.addEventListener('resize', scheduleReflow);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleReflow);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [reflowCalendar]);

  const hasBranches = branches.length > 0;
  const employeeDeptReadOnly = isEmployee && departments.length <= 1;

  if (!hasBranches) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin sucursales"
        description="Crea una sucursal para poder visualizar ausencias"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      <aside className="space-y-4">
        <div className="border border-theme-color rounded-xl p-3 bg-theme-surface-muted/40 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
            Sucursal
          </span>
          {isAdmin || canSelectBranch ? (
            <select
              value={branchSelectValue}
              onChange={(e) => onBranchChange(e.target.value)}
              className="input-field text-sm w-full"
            >
              {isAdmin && <option value="">Todas las sucursales</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code}){branch.isActive ? '' : ' · inactiva'}
                </option>
              ))}
            </select>
          ) : userBranchId ? (
            <div className="rounded-lg border border-theme-color px-3 py-2 bg-theme-surface text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-1">Sucursal activa</p>
              <p className="font-medium text-theme-primary">
                {(() => {
                  const b = branches.find((br) => br.id === userBranchId);
                  if (!b) return 'Sucursal asignada';
                  return b.code ? `${b.name} (${b.code})` : b.name;
                })()}
              </p>
            </div>
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              Sin sucursal asignada
            </p>
          )}
        </div>

        <div className="border border-theme-color rounded-xl p-3 bg-theme-surface-muted/40 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
            Departamento
          </span>
          {employeeDeptReadOnly ? (
            departments.length === 1 ? (
              <div className="rounded-lg border border-theme-color px-3 py-2 bg-theme-surface text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-1">Departamento</p>
                <p className="font-medium text-theme-primary">
                  {departments[0].code ? `${departments[0].name} (${departments[0].code})` : departments[0].name}
                </p>
              </div>
            ) : (
              <p className="text-xs text-theme-muted">Sin departamentos en esta sede</p>
            )
          ) : (
            <select
              value={selectedDepartmentId}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="input-field text-sm w-full"
            >
              <option value="">Todos los departamentos</option>
              {departments
                .filter((d) => !effectiveBranchId || d.branches?.some((b) => b.branch.id === effectiveBranchId))
                .map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
            </select>
          )}
        </div>

        <div className="border border-theme-color rounded-xl p-3 bg-theme-surface-muted/40 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
            Departamentos (leyenda)
          </span>
          {departmentLabels.length === 0 ? (
            <p className="text-xs text-theme-muted">Sin datos disponibles</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {departmentLabels.map((label) => (
                <div key={label} className="flex items-center gap-2 text-[11px] text-theme-muted">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm opacity-80"
                    style={{ backgroundColor: departmentColors[label] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 rounded-xl">
            <LoadingSpinner size="lg" />
          </div>
        )}

        <div ref={calendarContainerRef} className="fc-google-like">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,listWeek',
            }}
            buttonText={{ today: 'Hoy', month: 'Mes', list: 'Lista' }}
            events={absenceEvents}
            dayMaxEvents={4}
            moreLinkClick="popover"
            navLinks
            stickyHeaderDates
            weekends
            eventClassNames={() => ['fc-absence-event']}
            eventContent={(info) => <AbsenceEventContent info={info} />}
            eventOrder="start,-duration,allDay,title"
            displayEventTime={false}
            height="auto"
            expandRows
            datesSet={(info) => {
              setDateRange({ from: info.start, to: info.end });
            }}
            eventDisplay="block"
            firstDay={1}
            eventClick={(arg) => {
              const id = arg.event.extendedProps.absenceId as string | undefined;
              if (id && onAbsenceIdSelect) onAbsenceIdSelect(id);
            }}
          />
        </div>
      </div>
    </div>
  );
}

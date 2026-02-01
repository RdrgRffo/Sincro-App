import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, CalendarDays, Clock3, MapPin, Pencil, Tag, Trash2, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useScheduleTypes } from '@/hooks/useScheduleTypes';
import type { BranchHoliday, CalendarBranchHoliday, Schedule, ScheduleType } from '@/types';

export interface PopoverAnchor {
  x: number;
  y: number;
}

export type CalendarDetailItem =
  | {
      kind: 'schedule';
      schedule: Schedule;
      branchName?: string;
    }
  | {
      kind: 'holiday';
      holiday: CalendarBranchHoliday;
      branchName?: string;
    };

interface CalendarDetailPopoverProps {
  open: boolean;
  item: CalendarDetailItem | null;
  anchor: PopoverAnchor | null;
  canEditSchedule: boolean;
  canEditHoliday: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssigneeClick?: (user: Schedule['assignments'][number]['user']) => void;
}

const HOLIDAY_TYPE_LABELS: Record<BranchHoliday['type'], string> = {
  nacional: 'Nacional',
  autonomica: 'Autonomica',
  local: 'Local',
  mejora: 'Mejora convenio',
  regional: 'Regional',
  company: 'Empresa',
};

function getScheduleTypeInfo(type: string, scheduleTypes: ScheduleType[]) {
  return scheduleTypes.find((item) => item.value === type) ?? scheduleTypes[0] ?? { 
    value: type, 
    label: type, 
    color: '#1e3a5f' 
  };
}

function formatScheduleRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Fecha no disponible';
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${format(start, "EEEE, dd 'de' MMMM", { locale: es })} · ${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  }

  return `${format(start, 'dd/MM/yyyy HH:mm')} - ${format(end, 'dd/MM/yyyy HH:mm')}`;
}

function formatHolidayDate(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso.slice(0, 10);
  return format(date, "EEEE, dd 'de' MMMM", { locale: es });
}

function isGroupedHoliday(holiday: CalendarBranchHoliday): holiday is Extract<CalendarBranchHoliday, { holidayIds: string[] }> {
  return 'holidayIds' in holiday;
}

const POPOVER_WIDTH = 340;
const POPOVER_ESTIMATED_HEIGHT = 320;

function getInitialStyle(anchor: PopoverAnchor | null, mobile: boolean): CSSProperties {
  if (mobile || !anchor) {
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'min(92vw, 360px)',
    };
  }

  const gap = 12;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const margin = 8;

  const rawLeft = anchor.x + gap;
  const rawTop = anchor.y + gap;

  const left = Math.min(rawLeft, vw - POPOVER_WIDTH - margin);
  const top = Math.min(rawTop, vh - POPOVER_ESTIMATED_HEIGHT - margin);

  return {
    position: 'fixed',
    left: Math.max(margin, left),
    top: Math.max(margin, top),
    width: POPOVER_WIDTH,
    zIndex: 50,
  };
}

function ActionButton({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`calendar-popover-icon-btn ${danger ? 'calendar-popover-icon-btn-danger' : ''}`}
    >
      {children}
    </button>
  );
}

export function CalendarDetailPopover({
  open,
  item,
  anchor,
  canEditSchedule,
  canEditHoliday,
  onClose,
  onEdit,
  onDelete,
  onAssigneeClick,
}: CalendarDetailPopoverProps) {
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : true));
  const popoverRef = useRef<HTMLElement | null>(null);

  const { data: scheduleTypes = [] } = useScheduleTypes();

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      // Solo cerramos si el clic fue específicamente en el overlay (fondo)
      // Esto evita cierres accidentales al usar barras de scroll o clics imprecisos.
      if (event.target instanceof HTMLElement && event.target.classList.contains('calendar-popover-overlay')) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [open, onClose]);

  const style = useMemo(() => getInitialStyle(anchor, mobile), [anchor, mobile]);

  if (!open || !item) return null;

  const canEdit = item.kind === 'schedule' ? canEditSchedule : canEditHoliday;

  return (
    <div
      className={`calendar-popover-overlay ${mobile ? 'calendar-popover-overlay-mobile' : ''}`}
      role="presentation"
    >
      <article
        ref={popoverRef}
        className="calendar-popover"
        style={style}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="calendar-popover-header">
          <div className="calendar-popover-header-actions">
            {canEdit && (
              <>
                <ActionButton title="Editar" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </ActionButton>
                <ActionButton title="Eliminar" onClick={onDelete} danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </ActionButton>
              </>
            )}
            <ActionButton title="Cerrar" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </header>

        {item.kind === 'schedule' ? (
          <div className="calendar-popover-body">
            <h3 className="calendar-popover-title">{item.schedule.title}</h3>

            <div className="calendar-popover-row">
              <Clock3 className="h-4 w-4" />
              <span>{formatScheduleRange(item.schedule.startDatetime, item.schedule.endDatetime)}</span>
            </div>

            <div className="calendar-popover-row">
              <Tag className="h-4 w-4" />
              <span>
                {getScheduleTypeInfo(item.schedule.type, scheduleTypes).label}
                {item.schedule.isLastMinute ? ' · Ultimo momento' : ''}
              </span>
            </div>

            {item.branchName && (
              <div className="calendar-popover-row">
                <MapPin className="h-4 w-4" />
                <span>{item.branchName}</span>
              </div>
            )}

            {item.schedule.assignments.length > 0 && (
              <div className="calendar-popover-row">
                <Users className="h-4 w-4" />
                <div className="calendar-popover-assignees">
                  {item.schedule.assignments.slice(0, 6).map((assignment) => (
                    <button
                      key={assignment.userId}
                      type="button"
                      className="calendar-popover-assignee-btn"
                      onClick={() => onAssigneeClick?.(assignment.user)}
                    >
                      {assignment.user.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.schedule.notes && <p className="calendar-popover-note">{item.schedule.notes}</p>}
          </div>
        ) : (
          <div className="calendar-popover-body">
            <h3 className="calendar-popover-title">{item.holiday.name}</h3>

            <div className="calendar-popover-row">
              <CalendarDays className="h-4 w-4" />
              <span>{formatHolidayDate(item.holiday.date)}</span>
            </div>

            <div className="calendar-popover-row">
              <Tag className="h-4 w-4" />
              <span>{HOLIDAY_TYPE_LABELS[item.holiday.type]}</span>
            </div>

            {item.branchName && (
              <div className="calendar-popover-row">
                <MapPin className="h-4 w-4" />
                <span>{item.branchName}</span>
              </div>
            )}

            {isGroupedHoliday(item.holiday) && (
              <div className="calendar-popover-row">
                <Users className="h-4 w-4" />
                <span>{`Compartido en ${item.holiday.sharedCount} sucursales`}</span>
              </div>
            )}

            <div className="calendar-popover-info">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>
                Para ocultar estas celebraciones, usa la configuracion de festivos de la sucursal.
              </span>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

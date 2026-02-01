import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import { Plus, Building2, PanelLeftClose, PanelLeft } from 'lucide-react';

import { ScheduleSidebar } from '@/components/schedule/ScheduleSidebar';
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  CalendarDetailPopover,
  type CalendarDetailItem,
  type PopoverAnchor,
} from '@/components/schedule/CalendarDetailPopover';
import { HolidayEditModal } from '@/components/schedule/HolidayEditModal';
import { UserProfileModal } from '@/components/common/UserProfileModal';
import { ShiftModal } from '@/components/schedule/ShiftModal';
import { ScheduleSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import api from '@/config/api';
import type {
  Branch,
  BranchHoliday,
  CalendarBranchHoliday,
  Schedule,
  ScheduleAssignment,
  
} from '@/types';
import { format } from 'date-fns';
import { getApiErrorMessage } from '@/lib/apiError';
import { useScheduleTypes } from '@/hooks/useScheduleTypes';
import { useScheduleData } from '@/hooks/useScheduleData';
import { toLocalDateOnly } from '@/lib/scheduleUtils';
import { useBranchScope, useEffectiveBranchId } from '@/hooks/useBranchScope';

function computePopoverAnchorFromEventEl(
  eventEl: HTMLElement,
  pageContainerEl: HTMLElement | null,
): PopoverAnchor {
  const rect = eventEl.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const pageRect = pageContainerEl?.getBoundingClientRect();
  return {
    x: pageRect ? clientX - pageRect.left : clientX,
    y: pageRect ? clientY - pageRect.top : clientY,
  };
}

function isGroupedHoliday(holiday: CalendarBranchHoliday): holiday is Extract<CalendarBranchHoliday, { holidayIds: string[] }> {
  return 'holidayIds' in holiday;
}

/* ─── main page ─────────────────────────────────────────────────── */

export function SchedulePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { initialView?: string; initialDate?: string } | null;
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const scheduleSidebarOpen = useUIStore((s) => s.scheduleSidebarOpen);
  const toggleScheduleSidebar = useUIStore((s) => s.toggleScheduleSidebar);
  // Role checks are now provided by useBranchScope hook below


  const calendarRef = useRef<FullCalendar>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const skipNextRouteDetailSyncRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>();
  const [detailItem, setDetailItem] = useState<CalendarDetailItem | null>(null);
  const [detailAnchor, setDetailAnchor] = useState<PopoverAnchor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarDetailItem | null>(null);
  const [holidayEditTarget, setHolidayEditTarget] = useState<CalendarBranchHoliday | null>(null);
  const [pendingDateSelect, setPendingDateSelect] = useState<DateSelectArg | null>(null);
  const [holidayWarningOpen, setHolidayWarningOpen] = useState(false);
  const [holidayWarningNames, setHolidayWarningNames] = useState<string[]>([]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<ScheduleAssignment['user'] | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('schedule.hiddenTypes') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  });
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [activeView, setActiveView] = useState(navState?.initialView || 'dayGridMonth');
  const [dateRange, setDateRange] = useState(() => {
    if (navState?.initialDate) {
      const d = new Date(navState.initialDate);
      return { from: d, to: d };
    }
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  });
  const shouldUseWeekEndpoint = activeView !== 'dayGridMonth';
  const weekRefDate = dateRange.from;

  const { data: branches } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'schedule-page', user?.id, user?.role?.name],
    queryFn: () => api.get('/branches', { params: { includeInactive: true } }).then((r) => r.data),
  });

  const branchScope = useBranchScope({ branches: branches?.data ?? [] });
  const { scopedBranches, canSelectBranches, canViewAllBranches, canEdit, isAdmin, isEmployee, branchNameById, availableBranches } = branchScope;

  const effectiveActiveBranchId = useEffectiveBranchId({
    scopedBranches,
    canSelectBranches,
    activeBranchId,
    defaultScopedBranchId: branchScope.defaultScopedBranchId,
    userBranchId: user?.branchId,
  });

  // Use shared hook to fetch schedules, branch holidays and schedule detail
  const {
    departmentList,
    schedules: schedulesFromHook,
    schedulesLoading,
    branchHolidays: branchHolidaysFromHook,
    scheduleDetail: scheduleDetailFromHook,
  } = useScheduleData({
    activeBranchId: effectiveActiveBranchId,
    selectedDeptId: selectedDeptId,
    filterUserId,
    shouldUseWeekEndpoint,
    weekRefDate,
    dateRange,
    scheduleId,
    fetchAllWhenNoBranch: branchScope.canViewAllBranches,
  });

  const schedules = schedulesFromHook;
  const isLoading = schedulesLoading;
  const branchHolidays = branchHolidaysFromHook;
  const scheduleDetail = scheduleDetailFromHook;

  const effectiveSelectedDeptId = useMemo(() => {
    if (!isEmployee) return selectedDeptId;
    if (departmentList.length === 1) return departmentList[0].id;
    if (departmentList.length === 0) return '';
    return selectedDeptId;
  }, [isEmployee, departmentList, selectedDeptId]);

  const { types: scheduleTypes = [] } = useScheduleTypes();

  const deleteScheduleMutation = useMutation({
    mutationFn: (schedule: Schedule) =>
      api.delete(`/schedules/${schedule.id}`, { data: { reason: 'Eliminada desde el calendario' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['schedule-detail'] });
      toast.success('Turno eliminado');
      setDeleteTarget(null);
      setDetailItem(null);
      setDetailAnchor(null);
      if (scheduleId) {
        navigate('/schedule', { replace: true });
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el turno'));
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (holiday: CalendarBranchHoliday) => {
      if (isGroupedHoliday(holiday)) {
        return api.delete('/branches/all/holidays/bulk', { data: { holidayIds: holiday.holidayIds } });
      }
      return api.delete(`/branches/${holiday.branchId}/holidays/${holiday.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-holidays'] });
      qc.invalidateQueries({ queryKey: ['branch-holidays-calendar'] });
      toast.success('Festivo eliminado');
      setDeleteTarget(null);
      setDetailItem(null);
      setDetailAnchor(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el festivo'));
    },
  });

  const detailScheduleId = detailItem?.kind === 'schedule' ? detailItem.schedule.id : null;
  const pendingRouteDetailRef = useRef(false);

  /* Efecto separado para sincronizar detailItem con navegación por ruta (sin setState síncrono) */
  useEffect(() => {
    if (!scheduleId || !scheduleDetail) return;
    if (skipNextRouteDetailSyncRef.current) {
      skipNextRouteDetailSyncRef.current = false;
      return;
    }
    if (modalOpen || Boolean(deleteTarget) || Boolean(holidayEditTarget) || profileModalOpen) return;
    if (detailScheduleId === scheduleDetail.id) return;

    pendingRouteDetailRef.current = true;
  }, [scheduleId, scheduleDetail, detailScheduleId, modalOpen, deleteTarget, holidayEditTarget, profileModalOpen]);

  useEffect(() => {
    if (!scheduleId || !scheduleDetail) return;
    if (skipNextRouteDetailSyncRef.current) {
      skipNextRouteDetailSyncRef.current = false;
      return;
    }
    if (modalOpen || Boolean(deleteTarget) || Boolean(holidayEditTarget) || profileModalOpen) return;

    /* Clic en el calendario: mismo turno y ancla ya definida; no tocar */
    if (detailScheduleId === scheduleDetail.id && detailAnchor) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 72;

    const tryPosition = () => {
      if (cancelled) return;

      /* Navegación desde DashboardPage: establecer detailItem en el primer rAF (diferido) */
      if (pendingRouteDetailRef.current) {
        pendingRouteDetailRef.current = false;
        setDetailItem({
          kind: 'schedule',
          schedule: scheduleDetail,
          branchName: scheduleDetail.branchId ? branchNameById[scheduleDetail.branchId] : undefined,
        });
      }

      const container = calendarContainerRef.current;
      const pageEl = pageContainerRef.current;
      const el = container?.querySelector(`[data-schedule-id="${scheduleDetail.id}"]`);

      if (el instanceof HTMLElement && pageEl) {
        setDetailAnchor(computePopoverAnchorFromEventEl(el, pageEl));
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryPosition);
      } else {
        setDetailAnchor(null);
      }
    };

    requestAnimationFrame(tryPosition);
    return () => {
      cancelled = true;
    };
  }, [
    scheduleId,
    scheduleDetail,
    detailScheduleId,
    detailAnchor,
    branchNameById,
    modalOpen,
    deleteTarget,
    holidayEditTarget,
    profileModalOpen,
    schedules,
    isLoading,
    hiddenTypes,
  ]);

  const typeCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!schedules) return counts;
    schedules.forEach((s) => {
      // Buscar el tipo en scheduleTypes para obtener el value correcto
      let typeValue = s.type?.trim() || 'unknown';
      if (s.scheduleTypeId) {
        const found = scheduleTypes.find((t) => t.value === s.scheduleTypeId || t.id === s.scheduleTypeId);
        if (found) typeValue = found.value;
      } else {
        const found = scheduleTypes.find((t) => t.value === typeValue);
        if (found) typeValue = found.value;
      }
      counts[typeValue] = (counts[typeValue] ?? 0) + 1;
    });
    return counts;
  }, [schedules, scheduleTypes]);


  const holidayTypeCounts = useMemo(() => {
    const counts: Partial<Record<BranchHoliday['type'], number>> = {};
    (branchHolidays?.data ?? []).forEach((holiday) => {
      counts[holiday.type] = (counts[holiday.type] ?? 0) + 1;
    });
    return counts;
  }, [branchHolidays?.data]);

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Persist `hiddenTypes` to localStorage so selection survives navigations
  useEffect(() => {
    try {
      localStorage.setItem('schedule.hiddenTypes', JSON.stringify(Array.from(hiddenTypes)));
    } catch {
      // ignore
    }
  }, [hiddenTypes]);

  const handleBranchChange = useCallback((branchId: string) => {
    setActiveBranchId(branchId);
    setSelectedDeptId('');
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    if (info.event.extendedProps.isHolidayBackground) return;

    const rect = info.el.getBoundingClientRect();
    const clientX = info.jsEvent.clientX > 0 ? info.jsEvent.clientX : rect.left + rect.width / 2;
    const clientY = info.jsEvent.clientY > 0 ? info.jsEvent.clientY : rect.top + rect.height / 2;

    const pageRect = pageContainerRef.current?.getBoundingClientRect();
    const x = pageRect ? clientX - pageRect.left : clientX;
    const y = pageRect ? clientY - pageRect.top : clientY;

    if (info.event.extendedProps.isHoliday) {
      const holiday = info.event.extendedProps.holiday as CalendarBranchHoliday | undefined;
      if (!holiday) return;

      setDetailItem({
        kind: 'holiday',
        holiday,
        branchName: isGroupedHoliday(holiday)
          ? holiday.branches.map((branch) => branch.name).join(', ')
          : branchNameById[holiday.branchId],
      });
      setDetailAnchor({ x, y });
      if (scheduleId) {
        navigate('/schedule', { replace: true });
      }
      return;
    }

    const clickedSchedule = info.event.extendedProps.schedule as Schedule | undefined;
    if (!clickedSchedule) return;

    setDetailItem({
      kind: 'schedule',
      schedule: clickedSchedule,
      branchName: clickedSchedule.branchId ? branchNameById[clickedSchedule.branchId] : undefined,
    });
    setDetailAnchor({ x, y });
    navigate(`/schedule/${clickedSchedule.id}`);
  }, [branchNameById, navigate, scheduleId]);

  const handleDateSelect = useCallback(
    (info: DateSelectArg) => {
      if (!canEdit) return;

      // Verificar si la fecha seleccionada coincide con algún festivo
      const selectedDateStr = format(info.start, 'yyyy-MM-dd');
      const holidaysOnDate = (branchHolidays?.data ?? []).filter((h) => {
        const holidayDateStr = toLocalDateOnly(h.date);
        return holidayDateStr === selectedDateStr;
      });

      if (holidaysOnDate.length > 0) {
        setPendingDateSelect(info);
        setHolidayWarningNames(holidaysOnDate.map((h) => h.name));
        setHolidayWarningOpen(true);
        return;
      }

      setDetailItem(null);
      setDetailAnchor(null);
      setSelectedSchedule(null);
      setDefaultStart(info.start);
      // FullCalendar's end is exclusive (day after selection), so subtract one day
      const adjustedEnd = new Date(info.end);
      adjustedEnd.setDate(adjustedEnd.getDate() - 1);
      setDefaultEnd(adjustedEnd);
      setModalOpen(true);
      if (scheduleId) navigate('/schedule', { replace: true });
    },
    [canEdit, navigate, scheduleId, branchHolidays],

  );

    const handleEventMount = useCallback((eventId: string, el: HTMLElement) => {
      if (!scheduleDetail) return;
      if (scheduleDetail.id === eventId && pageContainerRef.current) {
        setDetailAnchor(computePopoverAnchorFromEventEl(el, pageContainerRef.current));
      }
    }, [scheduleDetail]);

  const handleConfirmHolidaySchedule = useCallback(() => {
    setHolidayWarningOpen(false);
    if (!pendingDateSelect) return;
    setDetailItem(null);
    setDetailAnchor(null);
    setSelectedSchedule(null);
    setDefaultStart(pendingDateSelect.start);
    // FullCalendar's end is exclusive (day after selection), so subtract one day
    const adjustedEnd = new Date(pendingDateSelect.end);
    adjustedEnd.setDate(adjustedEnd.getDate() - 1);
    setDefaultEnd(adjustedEnd);
    setModalOpen(true);
    setPendingDateSelect(null);
    if (scheduleId) navigate('/schedule', { replace: true });
  }, [pendingDateSelect, navigate, scheduleId]);


  const handleCancelHolidaySchedule = useCallback(() => {
    setHolidayWarningOpen(false);
    setPendingDateSelect(null);
  }, []);

  const closeDetailPopover = useCallback(() => {
    if (scheduleId) {
      skipNextRouteDetailSyncRef.current = true;
    }
    setDetailItem(null);
    setDetailAnchor(null);
    if (scheduleId) {
      navigate('/schedule', { replace: true });
    }
  }, [navigate, scheduleId]);

  const handleEditDetail = useCallback(() => {
    if (!detailItem) return;

    if (detailItem.kind === 'schedule') {
      setSelectedSchedule(detailItem.schedule);
      setDefaultStart(undefined);
      setDefaultEnd(undefined);
      setModalOpen(true);
    } else if (isAdmin) {
      setHolidayEditTarget(detailItem.holiday);
    }

    setDetailItem(null);
    setDetailAnchor(null);
  }, [detailItem, isAdmin]);

  const handleDeleteDetail = useCallback(() => {
    if (!detailItem) return;
    setDetailItem(null);
    setDetailAnchor(null);
    setDeleteTarget(detailItem);
  }, [detailItem]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === 'schedule') {
      deleteScheduleMutation.mutate(deleteTarget.schedule);
      return;
    }

    deleteHolidayMutation.mutate(deleteTarget.holiday);
  }, [deleteTarget, deleteScheduleMutation, deleteHolidayMutation]);

  const handleAssigneeClick = useCallback((userProfile: ScheduleAssignment['user']) => {
    setSelectedProfileUser(userProfile);
    setProfileModalOpen(true);
    setDetailItem(null);
    setDetailAnchor(null);
    if (scheduleId) {
      navigate('/schedule', { replace: true });
    }
  }, [navigate, scheduleId]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedSchedule(null);
    setDefaultStart(undefined);
    setDefaultEnd(undefined);
    if (scheduleId) {
      navigate('/schedule', { replace: true });
    }
  }, [navigate, scheduleId]);

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

  useEffect(() => {
    // Trigger an immediate reflow — ResizeObserver handles subsequent changes.
    reflowCalendar();
    return undefined;
  }, [sidebarCollapsed, reflowCalendar]);

  return (
    <div ref={pageContainerRef} className="relative space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleScheduleSidebar}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface/80 transition-colors"
            title={scheduleSidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          >
            {scheduleSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">Planificación de Turnos</h1>
            <p className="text-sm text-theme-muted mt-0.5">
              Gestiona los turnos y asignaciones del personal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">

          {canEdit && (
            <button
              onClick={() => {
                const start = new Date();
                start.setMinutes(0, 0, 0);
                start.setHours(start.getHours() + 1);
                const end = new Date(start);
                end.setHours(end.getHours() + 8);
                setDetailItem(null);
                setDetailAnchor(null);
                setSelectedSchedule(null);
                setDefaultStart(start);
                setDefaultEnd(end);
                setModalOpen(true);
              }}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo Turno
            </button>
          )}
        </div>
      </div>

      {/* Employee sin sucursal asignada */}
      {isEmployee && !user?.branchId ? (
        <div className="card p-6">
          <EmptyState
            icon={Building2}
            title="Sin sucursal asignada"
            description="No tienes una sucursal asignada. Contacta con tu administrador para que te asigne a una sucursal."
          />
        </div>
      ) : (
      <>
      <div className="card relative overflow-hidden">
        {isLoading && !schedules && (
          <div className="p-6">
            <ScheduleSkeleton />
          </div>
        )}

        <div className={isLoading && !schedules ? 'hidden' : scheduleSidebarOpen ? 'grid grid-cols-[280px_minmax(0,1fr)]' : 'grid grid-cols-1'}>

          {scheduleSidebarOpen && (
            <ScheduleSidebar
              branches={scopedBranches}
              activeBranchId={activeBranchId}
              effectiveActiveBranchId={effectiveActiveBranchId}
              canSelectBranches={canSelectBranches}
              canViewAllBranches={canViewAllBranches}
              onBranchChange={handleBranchChange}
              departments={departmentList}
              selectedDeptId={effectiveSelectedDeptId}
              onDepartmentChange={setSelectedDeptId}
              hiddenTypes={hiddenTypes}
              onToggleType={toggleType}
              typeCounts={typeCounts}
              holidayTypeCounts={holidayTypeCounts}
              scheduleTypes={scheduleTypes}
              isEmployee={isEmployee}
              filterUserId={filterUserId}
              onFilterUserChange={setFilterUserId}
            />
          )}


          {/* Calendar */}
          <div className="p-6">
            <ScheduleCalendar
              schedules={schedules ?? null}
              branchHolidays={branchHolidays ?? null}
              scheduleTypes={scheduleTypes}
              canEdit={canEdit}
              activeView={activeView}
              navStateInitialView={navState?.initialView}
              navStateInitialDate={navState?.initialDate}
              onDateSelect={handleDateSelect}
              onEventClick={handleEventClick}
              onEventMount={handleEventMount}
              onDatesSet={(info) => { setActiveView(info.view.type); setDateRange({ from: info.start, to: info.end }); }}
              calendarRef={calendarRef}
              hiddenTypes={hiddenTypes}
            />
          </div>
        </div>
      </div>

      {/* Pie informativo para admin en vista "Todas las sucursales" */}
      {canViewAllBranches && !effectiveActiveBranchId && (
        <p className="text-xs text-theme-muted text-center mt-2">
          Los turnos se muestran en UTC. Cada sucursal tiene su propia franja horaria:{' '}
          {availableBranches
            .filter((b) => b.timezone)
            .map((b) => `${b.name} (${b.timezone})`)
            .join(', ')}.
          Al seleccionar una sucursal en el panel lateral, el calendario se ajusta a su zona horaria.
        </p>
      )}

      <ShiftModal
        open={modalOpen}
        onClose={closeModal}
        schedule={selectedSchedule}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        defaultBranchId={effectiveActiveBranchId}
        defaultDepartmentId={effectiveSelectedDeptId}
      />

      <CalendarDetailPopover
        open={Boolean(detailItem)}
        item={detailItem}
        anchor={detailAnchor}
        canEditSchedule={canEdit}
        canEditHoliday={isAdmin}
        onClose={closeDetailPopover}
        onEdit={handleEditDetail}
        onDelete={handleDeleteDetail}
        onAssigneeClick={handleAssigneeClick}
      />

      <HolidayEditModal
        key={holidayEditTarget?.id ?? 'holiday-edit-empty'}
        open={Boolean(holidayEditTarget)}
        holiday={holidayEditTarget}
        branchName={holidayEditTarget ? branchNameById[holidayEditTarget.branchId] : undefined}
        onClose={() => setHolidayEditTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'holiday' ? 'Eliminar festivo' : 'Eliminar turno'}
        description={
          deleteTarget?.kind === 'holiday'
            ? `¿Quieres eliminar "${deleteTarget.holiday.name}"?`
            : `¿Quieres eliminar "${deleteTarget?.kind === 'schedule' ? deleteTarget.schedule.title : ''}"?`
        }
        confirmLabel="Eliminar"
        loading={deleteScheduleMutation.isPending || deleteHolidayMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={holidayWarningOpen}
        title="Día festivo"
        description={`La fecha seleccionada coincide con ${holidayWarningNames.length > 1 ? 'los siguientes festivos' : 'un festivo'}: ${holidayWarningNames.join(', ')}. ¿Quieres crear el turno de todas formas?`}
        confirmLabel="Crear de todas formas"
        variant="warning"
        onConfirm={handleConfirmHolidaySchedule}
        onCancel={handleCancelHolidaySchedule}
      />

      <UserProfileModal
        open={profileModalOpen}
        user={selectedProfileUser}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedProfileUser(null);
        }}
      />
      </>
      )}
    </div>
  );
}

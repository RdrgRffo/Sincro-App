import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Trash2, Clock, MapPin, FileText, Users, Info, AlertTriangle, CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import { useScheduleTypes } from '@/hooks/useScheduleTypes';
import type { BranchHoliday, Schedule, User } from '@/types';
import type { FullScheduleType } from './scheduleTypesApi';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { UserProfileModal } from '@/components/common/UserProfileModal';
import { useAuthStore } from '@/store/authStore';
import { useBranchScope } from '@/hooks/useBranchScope';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  buildChunkRange,
  buildDateRange,
  buildDateTime,
  buildScheduleChunks,
  getPresetDurationHours,
  normalizeDate,
  parseTimeToMinutes,
  toIsoDate,
  type ShiftPreset,
} from './shiftScheduling';

const HOLIDAY_COLORS: Record<BranchHoliday['type'], string> = {
  nacional: '#dc2626',
  autonomica: '#ea580c',
  local: '#d97706',
  mejora: '#65a30d',
  regional: '#0ea5e9',
  company: '#7c3aed',
};

const HOLIDAY_TYPE_LABELS: Record<BranchHoliday['type'], string> = {
  nacional: 'Nacional',
  autonomica: 'Autonómica',
  local: 'Local',
  mejora: 'Mejora convenio',
  regional: 'Regional',
  company: 'Empresa',
};


const shiftSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  type: z.string().default('guardia'),
  // `scheduleTypeId` puede estar vacío si no hay tipos disponibles. Validación adicional se hace onSubmit.
  scheduleTypeId: z.string().optional(),
  color: z.string().default('#2563eb'),
  location: z.string().optional(),
  notes: z.string().optional(),
  // `branchId` puede resolverse automáticamente; validación adicional se hace onSubmit.
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  reason: z.string().optional(),
});

type ShiftForm = z.infer<typeof shiftSchema>;
type ShiftFormInput = z.input<typeof shiftSchema>;
type ShiftPayload = ShiftForm & {
  startDatetime: string;
  endDatetime: string;
  hoursPerDay: number;
  assigneeIds: string[];
  confirmed?: boolean;
};
type ShiftBulkPayload = { items: ShiftPayload[] };

interface ShiftModalProps {
  open: boolean;
  onClose: () => void;
  schedule?: Schedule | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultBranchId?: string;
  defaultDepartmentId?: string;
}

export function ShiftModal({ open, onClose, schedule, defaultStart, defaultEnd, defaultBranchId, defaultDepartmentId }: ShiftModalProps) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role?.name === 'admin' || user?.role?.name === 'general_manager' || user?.role?.name === 'department_manager';
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSplit, setConfirmSplit] = useState(false);
  const [holidayConflicts, setHolidayConflicts] = useState<BranchHoliday[]>([]);
  const [pendingPayload, setPendingPayload] = useState<ShiftBulkPayload | null>(null);
  const [pendingSplitPayload, setPendingSplitPayload] = useState<{
    items: ShiftPayload[];
    reason?: string;
  } | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [asideBranchFilter, setAsideBranchFilter] = useState('');
  const [asideDeptFilter, setAsideDeptFilter] = useState(''); // Corregido: Inicializado como string vacío
  const [asideSearchFilter, setAsideSearchFilter] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [defaultShiftPresetId, setDefaultShiftPresetId] = useState('');
  const [dayShiftOverrides, setDayShiftOverrides] = useState<Record<string, string>>({});
  const [customShiftTimes, setCustomShiftTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [shiftAnchorDate, setShiftAnchorDate] = useState<Date | null>(null);
  const [shiftRangeDates] = useState<Date[]>([]);
  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);
  const calendarPanelRef = useRef<HTMLDivElement | null>(null);

  const { types: scheduleTypes = [] } = useScheduleTypes();

  const { data: users } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => api.get<{ data: User[] }>('/users?limit=500&status=active').then((r) => r.data.data),
    enabled: open && canEdit,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches', 'shift-modal'],
    queryFn: () => api.get('/branches').then((r) => r.data?.data ?? []),
    enabled: open && canEdit,
  });

  const { data: shiftPresets = [] } = useQuery<ShiftPreset[]>({
    queryKey: ['shift-presets', 'modal'],
    queryFn: async () => {
      const { data } = await api.get('/shift-presets');
      return data.data ?? [];
    },
    enabled: open,
  });
  const firstShiftPresetId = shiftPresets[0]?.id ?? '';

  const toIsoFromLocalInput = (value: Date) => value.toISOString();

  const { register, handleSubmit, reset, watch, setValue, getValues, formState: { errors } } = useForm<ShiftFormInput, unknown, ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      type: 'guardia',
      scheduleTypeId: '',
      color: '#2563eb',
      branchId: user?.branchId ?? defaultBranchId ?? '',
      departmentId: user?.departmentId ?? undefined,
    },
  });

  // Resolve departmentId based on role
  const resolvedDepartmentId = useMemo(() => {
    if (schedule?.departmentId) return schedule.departmentId;
    if (user?.role?.name === 'department_manager') return user.departmentId ?? undefined;
    return undefined;
  }, [schedule?.departmentId, user?.role?.name, user?.departmentId]);

  useEffect(() => {
    if (!open) return;
    if (schedule) {
      reset({
        title: schedule.title,
        description: schedule.description || '',
        type: schedule.type,
        scheduleTypeId: schedule.scheduleTypeId,
        color: schedule.color,
        location: schedule.location || '',
        notes: schedule.notes || '',
        branchId: schedule.branchId ?? defaultBranchId ?? '',
        departmentId: schedule.departmentId || resolvedDepartmentId || defaultDepartmentId || '',
      });
      setSelectedUsers(schedule.assignments.map((a) => a.userId));
    } else {
      reset({
        scheduleTypeId: scheduleTypes.find((t) => t.value === 'guardia')?.id || '',
        type: 'guardia',
        color: '#2563eb',
        branchId: user?.branchId ?? defaultBranchId ?? '',
        departmentId: resolvedDepartmentId || defaultDepartmentId || '',
      });
      setSelectedUsers([]);
    }

    const rangeStart = schedule ? new Date(schedule.startDatetime) : defaultStart;
    const rangeEnd = schedule ? new Date(schedule.endDatetime) : defaultEnd;
    if (rangeStart && rangeEnd) {
      setSelectedDates(buildDateRange(rangeStart, rangeEnd));
      const startTime = format(rangeStart, 'HH:mm');
      const endTime = format(rangeEnd, 'HH:mm');
      const matchedPreset = shiftPresets.find((preset) => preset.startTime === startTime && preset.endTime === endTime);
      if (matchedPreset) {
        setDefaultShiftPresetId(matchedPreset.id);
        setDayShiftOverrides({});
        setCustomShiftTimes({});
      } else if (schedule) {
        const dayKeys = buildDateRange(rangeStart, rangeEnd).map((d) => toIsoDate(d));
        const overrides = Object.fromEntries(dayKeys.map((key) => [key, 'custom']));
        const customTimes = Object.fromEntries(
          dayKeys.map((key) => [key, {
            startTime: format(rangeStart, 'HH:mm'),
            endTime: format(rangeEnd, 'HH:mm'),
          }]),
        );
        setDefaultShiftPresetId(firstShiftPresetId);
        setDayShiftOverrides(overrides);
        setCustomShiftTimes(customTimes);
      } else {
        setDefaultShiftPresetId(firstShiftPresetId);
        setDayShiftOverrides({});
        setCustomShiftTimes({});
      }
    } else {
      setSelectedDates([]);
      setDefaultShiftPresetId(firstShiftPresetId);
      setDayShiftOverrides({});
      setCustomShiftTimes({});
    }

    setCalendarOpen(false);
    setShiftAnchorDate(null);
  }, [open, schedule, defaultStart, defaultEnd, reset, defaultBranchId, defaultDepartmentId, user?.branchId, scheduleTypes, shiftPresets, firstShiftPresetId, resolvedDepartmentId]);
  const selectedType = watch('type');
  const selectedBranchId = watch('branchId');
  const isAllBranchesMode = !schedule && !defaultBranchId;
  const presetById = useMemo(
    () => Object.fromEntries(shiftPresets.map((preset) => [preset.id, preset])),
    [shiftPresets],
  );

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', 'shift-modal', selectedBranchId],
    queryFn: () => api.get('/departments', { params: { branchId: selectedBranchId || undefined } }).then((r) => r.data?.data ?? []),
    enabled: open && canEdit && Boolean(selectedBranchId),
  });

  const sortedSelectedDates = useMemo(
    () => [...selectedDates].sort((a, b) => normalizeDate(a).getTime() - normalizeDate(b).getTime()),
    [selectedDates],
  );
  const calendarSelectedDates = useMemo(() => {
    const map = new Map<string, Date>();
    selectedDates.forEach((date) => map.set(toIsoDate(date), date));
    shiftRangeDates.forEach((date) => map.set(toIsoDate(date), date));
    return [...map.values()].sort((a, b) => normalizeDate(a).getTime() - normalizeDate(b).getTime());
  }, [selectedDates, shiftRangeDates]);
  const effectiveDayShiftOverrides = useMemo(() => {
    const entries = Object.entries(dayShiftOverrides)
      .filter(([, id]) => Boolean(id))
      .map(([key, id]) => {
        if (id !== 'custom') return [key, id] as const;
        const custom = customShiftTimes[key];
        if (!custom?.startTime || !custom?.endTime) return [key, ''] as const;
        return [key, `custom:${custom.startTime}-${custom.endTime}`] as const;
      })
      .filter(([, id]) => Boolean(id));

    return Object.fromEntries(entries);
  }, [dayShiftOverrides, customShiftTimes]);
  const selectedDateKeys = useMemo(() => sortedSelectedDates.map((d) => toIsoDate(d)), [sortedSelectedDates]);
  const selectedDateSet = useMemo(() => new Set(selectedDateKeys), [selectedDateKeys]);
  const selectedRange = useMemo(() => {
    if (sortedSelectedDates.length === 0) return null;
    const start = normalizeDate(sortedSelectedDates[0]);
    const end = normalizeDate(sortedSelectedDates[sortedSelectedDates.length - 1]);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [sortedSelectedDates]);

  const branchScope = useBranchScope({ branches: branches ?? [] });
  const canFilterBranch = branchScope.isAdmin || branchScope.isDepartmentManager;
  const canFilterDepartment = branchScope.isAdmin || branchScope.isGeneralManager;

  const departmentOptions = useMemo(() => {
    const options = new Map<string, string>();
    (users ?? []).forEach((u) => {
      if (u.department?.id && u.department?.name) {
        options.set(u.department.id, u.department.name);
      }
    });
    return Array.from(options, ([id, name]) => ({ id, name }));
  }, [users]);

  // Determine the base pool of assignees based on user role and target branch/department
  const availableAssignees = useMemo(() => {
    const sourceUsers = users ?? [];
    if (user?.role?.name === 'admin') {
      return sourceUsers;
    }
    if (user?.role?.name === 'general_manager') {
      const targetBranchId = schedule?.branchId || defaultBranchId || user.branchId || '';
      return sourceUsers.filter((candidate) => candidate.branchId === targetBranchId);
    }
    if (user?.role?.name === 'department_manager') {
      return sourceUsers.filter((candidate) => candidate.department?.id === user.department?.id);
    }
    return [];
  }, [users, user?.role?.name, user?.branchId, user?.department?.id, schedule?.branchId, defaultBranchId]);
  const selectedAssigneeUsers = useMemo(() => {
    const sourceUsers = users ?? [];
    if (sourceUsers.length === 0 || selectedUsers.length === 0) return [];
    return sourceUsers.filter((u) => selectedUsers.includes(u.id));
  }, [users, selectedUsers]);

  const selectedBranchIds = useMemo(() => {
    return Array.from(new Set(selectedAssigneeUsers.map((u) => u.branchId).filter(Boolean))) as string[];
  }, [selectedAssigneeUsers]);

  const autoBranchId = useMemo(() => {
    if (schedule?.branchId) return schedule.branchId;
    if (selectedBranchIds.length > 0) return selectedBranchIds[0];
    if (defaultBranchId) return defaultBranchId;
    if (user?.branchId) return user.branchId;
    return '';
  }, [schedule?.branchId, selectedBranchIds, defaultBranchId, user?.branchId]);

  const selectedBranchName = useMemo(() => {
    if (schedule?.branch?.name) return schedule.branch.name;
    return selectedAssigneeUsers.find((u) => u.branch?.name)?.branch?.name;
  }, [schedule?.branch?.name, selectedAssigneeUsers]);

  useEffect(() => {
    if (!open || !canEdit) return;
    const currentBranchId = getValues('branchId');
    if (currentBranchId === autoBranchId) return;
    setValue('branchId', autoBranchId, { shouldValidate: true, shouldDirty: false });
  }, [open, canEdit, autoBranchId, getValues, setValue]);

  useEffect(() => {
    const typeColor = scheduleTypes.find((t: FullScheduleType) => t.value === selectedType)?.color || '#1e3a5f';
    setValue('color', typeColor);
  }, [selectedType, setValue, scheduleTypes]);

  useEffect(() => {
    setDayShiftOverrides((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!selectedDateSet.has(key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [selectedDateSet]);

  useEffect(() => {
    setCustomShiftTimes((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!selectedDateSet.has(key)) {
          delete next[key];
        }
      });
      return next;
    });
  }, [selectedDateSet]);

  useEffect(() => {
    if (!calendarOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (calendarPanelRef.current?.contains(target)) return;
      if (calendarButtonRef.current?.contains(target)) return;
      setCalendarOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [calendarOpen]);

  const handleDayClick = useCallback((day: Date, modifiers: { selected?: boolean }, event: React.MouseEvent) => {
    if (!canEdit) return;
    const normalizedDay = normalizeDate(day);
    const dayKey = toIsoDate(normalizedDay);

    setSelectedDates((prev) => {
      const selectedMap = new Map(prev.map((d) => [toIsoDate(d), d]));

      if (event.shiftKey && shiftAnchorDate) {
        const range = buildDateRange(shiftAnchorDate, normalizedDay);
        range.forEach((rangeDay) => {
          selectedMap.set(toIsoDate(rangeDay), rangeDay);
        });
        return Array.from(selectedMap.values());
      }

      if (modifiers.selected) {
        selectedMap.delete(dayKey);
      } else {
        selectedMap.set(dayKey, normalizedDay);
      }

      return Array.from(selectedMap.values());
    });

    setShiftAnchorDate(normalizedDay);
  }, [canEdit, shiftAnchorDate]);

  const { data: branchRangeHolidays } = useQuery({
    queryKey: ['branch-holidays-modal', selectedBranchId, selectedRange?.start?.toISOString(), selectedRange?.end?.toISOString()],
    queryFn: () =>
      api
        .get<{ data: BranchHoliday[] }>(`/branches/${selectedBranchId}/holidays`, {
          params: {
            ...(selectedRange ? { from: selectedRange.start.toISOString() } : {}),
            ...(selectedRange ? { to: selectedRange.end.toISOString() } : {}),
          },
        })
        .then((r) => r.data.data),
    enabled: open && Boolean(selectedBranchId) && Boolean(selectedRange),
  });

  const holidayDates = useMemo(
    () => new Set((branchRangeHolidays ?? []).map((h) => h.date.slice(0, 10))),
    [branchRangeHolidays],
  );

  const preview = useMemo(() => {
    if (selectedDateKeys.length === 0) return null;

    const totalHours = selectedDateKeys.reduce((acc, key) => {
      const presetId = effectiveDayShiftOverrides[key] ?? defaultShiftPresetId;
      if (presetId.startsWith('custom:')) {
        const signature = presetId.replace('custom:', '');
        const [startTime, endTime] = signature.split('-');
        const startMinutes = parseTimeToMinutes(startTime || '0:00');
        const endMinutes = parseTimeToMinutes(endTime || '0:00');
        const durationMinutes = endMinutes <= startMinutes
          ? 24 * 60 - startMinutes + endMinutes
          : endMinutes - startMinutes;
        return acc + Math.round((durationMinutes / 60) * 10) / 10;
      }

      const preset = presetById[presetId] ?? presetById[firstShiftPresetId];
      return acc + (preset ? getPresetDurationHours(preset) : 0);
    }, 0);

    const holidayHits = selectedDateKeys.filter((key) => holidayDates.has(key)).length;

    return {
      days: selectedDateKeys.length,
      totalHours: Math.round(totalHours * 10) / 10,
      holidayHits,
    };
  }, [selectedDateKeys, effectiveDayShiftOverrides, defaultShiftPresetId, presetById, firstShiftPresetId, holidayDates]);

  const createBulkMutation = useMutation({
    mutationFn: (payload: ShiftBulkPayload) => api.post('/schedules/bulk', payload),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      const created = Array.isArray(response?.data?.data) ? response.data.data.length : 0;
      toast.success(created > 1 ? `${created} turnos creados` : 'Turno creado');
      onClose();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error')),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ShiftPayload) =>
      api.patch(`/schedules/${schedule!.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Turno actualizado');
      onClose();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (reason: string) => api.delete(`/schedules/${schedule!.id}`, { data: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Turno eliminado');
      onClose();
    },
  });

  const checkHolidayConflicts = useCallback((selectedDayKeys: Set<string>, holidays: BranchHoliday[]) => {
    const hits = holidays.filter((holiday) => selectedDayKeys.has(holiday.date.slice(0, 10)));
    return hits.sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const buildPayloads = (data: ShiftForm) => {
    const chunks = buildScheduleChunks(sortedSelectedDates, effectiveDayShiftOverrides, defaultShiftPresetId);
    const items = chunks.map((chunk) => {
      if (chunk.presetId.startsWith('custom:')) {
        const signature = chunk.presetId.replace('custom:', '');
        const [startTime, endTime] = signature.split('-');
        if (!startTime || !endTime) {
          throw new Error('Horario personalizado inválido');
        }
        const start = buildDateTime(chunk.startDate, startTime);
        let end = buildDateTime(chunk.endDate, endTime);
        if (end.getTime() <= start.getTime()) {
          end = new Date(end.getTime());
          end.setDate(end.getDate() + 1);
        }
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        const durationMinutes = endMinutes <= startMinutes
          ? 24 * 60 - startMinutes + endMinutes
          : endMinutes - startMinutes;
        const hoursPerDay = Math.round((durationMinutes / 60) * 10) / 10;
        return {
          ...data,
          startDatetime: toIsoFromLocalInput(start),
          endDatetime: toIsoFromLocalInput(end),
          hoursPerDay,
          assigneeIds: selectedUsers,
        } satisfies ShiftPayload;
      }

      const preset = presetById[chunk.presetId] ?? presetById[shiftPresets[0]?.id ?? ''];
      if (!preset) {
        throw new Error('Preset de turno inválido');
      }
      const range = buildChunkRange(chunk, preset);
      return {
        ...data,
        startDatetime: toIsoFromLocalInput(range.start),
        endDatetime: toIsoFromLocalInput(range.end),
        hoursPerDay: range.hoursPerDay,
        assigneeIds: selectedUsers,
      } satisfies ShiftPayload;
    });
    return { chunks, items };
  };

  const onSubmit = (data: ShiftForm) => {
    if (selectedUsers.length === 0) {
      toast.error('Asigna al menos una persona');
      return;
    }

    if (!schedule && selectedBranchIds.length > 1) {
      toast.error('Selecciona personal de una sola sucursal para crear el turno');
      return;
    }

    if (!data.branchId) {
      toast.error('No se pudo determinar la sucursal del turno');
      return;
    }

    if ((scheduleTypes?.length ?? 0) > 0 && !data.scheduleTypeId) {
      toast.error('Selecciona un tipo de turno');
      return;
    }

    if (sortedSelectedDates.length === 0) {
      toast.error('Selecciona al menos un día');
      return;
    }

    const invalidCustom = selectedDateKeys.find((key) =>
      dayShiftOverrides[key] === 'custom'
      && (!customShiftTimes[key]?.startTime || !customShiftTimes[key]?.endTime)
    );
    if (invalidCustom) {
      toast.error('Completa la hora de entrada y salida del turno personalizado');
      return;
    }

    let payloadData;
    try {
      payloadData = buildPayloads(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar los turnos'));
      return;
    }
    // Si es edición y hay múltiples chunks, es una división de turno
    if (schedule && payloadData.chunks.length > 1) {
      const reason = data.reason || 'División de turno';
      setPendingSplitPayload({ items: payloadData.items, reason });
      setConfirmSplit(true);
      return;
    }

    const conflicts = checkHolidayConflicts(selectedDateSet, branchRangeHolidays ?? []);
    if (conflicts.length > 0) {
      setHolidayConflicts(conflicts);
      setPendingPayload({ items: payloadData.items });
      return;
    }

    if (schedule) updateMutation.mutate(payloadData.items[0]);
    else createBulkMutation.mutate({ items: payloadData.items });
  };

  const confirmDespiteHolidays = () => {
    if (!pendingPayload) return;
    const payloadWithConfirmation = {
      items: pendingPayload.items.map((item) => ({ ...item, confirmed: true })),
    };
    if (schedule) updateMutation.mutate(payloadWithConfirmation.items[0]);
    else createBulkMutation.mutate(payloadWithConfirmation);
    setHolidayConflicts([]);
    setPendingPayload(null);
  };


  const confirmSplitHandler = async () => {
    if (!pendingSplitPayload || !schedule) return;
    try {
      const reason = pendingSplitPayload.reason || 'División de turno';
      await deleteMutation.mutateAsync(reason);
      await createBulkMutation.mutateAsync({ items: pendingSplitPayload.items });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      toast.success(`Turno dividido en ${pendingSplitPayload.items.length} turnos`);
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Error al dividir el turno'));
    } finally {
      setConfirmSplit(false);
      setPendingSplitPayload(null);
    }
  };

  const cancelSplitDialog = () => {
    setConfirmSplit(false);
    setPendingSplitPayload(null);
  };

  const cancelConflictDialog = () => {
    setHolidayConflicts([]);
    setPendingPayload(null);
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const filteredUsers = useMemo(() => {
    let result = availableAssignees;

    if (canFilterBranch && asideBranchFilter) {
      result = result.filter((u) => u.branchId === asideBranchFilter);
    }
    if (canFilterDepartment && asideDeptFilter) {
      result = result.filter((u) => u.department?.id === asideDeptFilter);
    }
    if (asideSearchFilter) {
      const q = asideSearchFilter.toLowerCase();
      result = result.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return result;
  }, [availableAssignees, canFilterBranch, canFilterDepartment, asideBranchFilter, asideDeptFilter, asideSearchFilter]);

  const isLoading = createBulkMutation.isPending || updateMutation.isPending;
  const assigneesContent = (
    <>
      {filteredUsers.map((u) => (
        <label
          key={u.id}
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-theme-surface-muted cursor-pointer border-b border-theme-color last:border-0"
        >
          <input
            type="checkbox"
            checked={selectedUsers.includes(u.id)}
            onChange={() => toggleUser(u.id)}
            className="rounded border-theme-color text-theme-primary focus:ring-theme-primary"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-theme-primary truncate">{u.name}</p>
            <p className="text-xs text-theme-muted truncate">{u.department?.name || u.email}</p>
            {isAllBranchesMode && (
              <p className="text-[10px] text-theme-muted truncate mt-0.5">
                Sucursal: {u.branch?.name ?? 'Sin sucursal'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedProfileUser(u);
              setProfileModalOpen(true);
            }}
            className="p-1.5 text-theme-muted hover:text-theme-primary hover:bg-theme-surface-muted rounded-lg transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>
        </label>
      ))}
      {availableAssignees.length === 0 && (
        <div className="px-3 py-4 text-xs text-theme-muted text-center">
          No hay personal activo para la sucursal seleccionada.
        </div>
      )}
    </>
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
        <div className="card rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-theme-color bg-theme-surface z-10">
            <h2 className="text-lg font-semibold text-theme-primary">
              {schedule ? 'Editar Turno' : 'Nuevo Turno'}
            </h2>
            <div className="flex items-center gap-2">
              {schedule && canEdit && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-primary hover:bg-theme-surface-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] min-h-0 h-[calc(90vh-77px)]">
            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-7 space-y-5 overflow-y-auto min-h-0">
              {/* Title */}
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Título *</label>
              <input {...register('title')} className="input-field" placeholder="Nombre del turno" disabled={!canEdit} />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">Tipo</label>
              <div className="grid grid-cols-2 gap-1.5">
                {scheduleTypes.map((t: FullScheduleType) => {
                  const active = selectedType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      disabled={!canEdit}
                    onClick={() => {
                      if (canEdit) {
                        setValue('type', t.value);
                        setValue('scheduleTypeId', t.id, { shouldValidate: true });
                      }
                    }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all"
                      style={
                        active
                          ? { backgroundColor: t.color, borderColor: t.color, color: '#fff', boxShadow: `0 2px 8px ${t.color}55` }
                          : { backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border-color)', color: 'var(--theme-text-muted)' }
                      }
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border"
                        style={
                          active
                            ? { backgroundColor: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.6)' }
                            : { backgroundColor: t.color, borderColor: t.color }
                        }
                      />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" {...register('type')} />
              <input type="hidden" {...register('scheduleTypeId')} />
              <input type="hidden" {...register('branchId')} />
            </div>

            {/* Dates */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <CalendarDays className="inline h-3.5 w-3.5 mr-1" />Fechas *
                </label>
                <div className="relative">
                  <button
                    ref={calendarButtonRef}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setCalendarOpen((prev) => !prev)}
                    className="input-field text-sm flex items-center justify-between"
                  >
                    <span className="truncate text-left">
                      {selectedDateKeys.length === 0
                        ? 'Seleccionar dias'
                        : selectedDateKeys.length === 1
                          ? format(sortedSelectedDates[0], 'dd/MM/yyyy')
                          : `${format(sortedSelectedDates[0], 'dd/MM/yyyy')} - ${format(sortedSelectedDates[sortedSelectedDates.length - 1], 'dd/MM/yyyy')} (${selectedDateKeys.length} dias)`}
                    </span>
                    <CalendarDays className="h-4 w-4 text-theme-muted" />
                  </button>
                  {calendarOpen && (
                    <div
                      ref={calendarPanelRef}
                      className="absolute z-50 mt-2 rounded-2xl border border-theme-color bg-white shadow-xl p-3"
                    >
                      <DayPicker
                        mode="multiple"
                        weekStartsOn={1}
                        showOutsideDays
                        locale={es}
                        selected={calendarSelectedDates}
                        onDayClick={handleDayClick}
                        classNames={{
                          months: 'flex flex-col gap-3',
                          month: 'space-y-2',
                          caption: 'flex justify-between items-center px-2',
                          caption_label: 'text-sm font-semibold text-theme-primary',
                          nav: 'flex items-center gap-2',
                          nav_button: 'h-7 w-7 rounded-lg border border-theme-color text-theme-muted hover:text-theme-primary hover:bg-theme-surface-muted',
                          table: 'w-full border-collapse',
                          head_row: 'flex',
                          head_cell: 'w-9 text-[11px] uppercase tracking-wide text-theme-muted',
                          row: 'flex w-full',
                          cell: 'w-9 h-9 text-center',
                          day: 'w-9 h-9 rounded-lg text-sm text-theme-primary hover:bg-theme-surface-muted',
                          day_selected: 'bg-theme-primary text-white hover:bg-theme-primary',
                          day_today: 'border border-theme-primary',
                        }}
                      />
                    </div>
                  )}
                </div>
                {calendarSelectedDates.length === 0 && (
                  <p className="text-xs text-theme-muted mt-1">Elige uno o varios dias del calendario.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />Turno base
                </label>
                <select
                  value={defaultShiftPresetId}
                  onChange={(event) => setDefaultShiftPresetId(event.target.value)}
                  disabled={!canEdit}
                  className="input-field text-sm"
                >
                  {shiftPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} ({preset.startTime} - {preset.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-theme-muted">Ajustes por dia</p>
                {sortedSelectedDates.length === 0 ? (
                  <p className="text-xs text-theme-muted">Selecciona dias para definir turnos.</p>
                ) : (
                  sortedSelectedDates.map((date) => {
                    const key = toIsoDate(date);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-sm text-theme-primary w-32">
                          {format(date, 'EEE dd/MM', { locale: es })}
                        </span>
                        <select
                          value={dayShiftOverrides[key] ?? ''}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDayShiftOverrides((prev) => {
                              if (!value) {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              }
                              return { ...prev, [key]: value };
                            });
                            setCustomShiftTimes((prev) => {
                              if (value !== 'custom') {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              }
                              if (prev[key]) return prev;
                              const basePreset = presetById[defaultShiftPresetId] ?? presetById[shiftPresets[0]?.id ?? ''];
                              return {
                                ...prev,
                                [key]: {
                                  startTime: basePreset?.startTime ?? '08:00',
                                  endTime: basePreset?.endTime ?? '16:00',
                                },
                              };
                            });
                          }}
                          disabled={!canEdit}
                          className="input-field text-sm flex-1"
                        >
                          <option value="">Usar turno base</option>
                          <option value="custom">Turno personalizado</option>
                          {shiftPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} ({preset.startTime} - {preset.endTime})
                            </option>
                          ))}
                        </select>
                        {dayShiftOverrides[key] === 'custom' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={customShiftTimes[key]?.startTime ?? ''}
                              onChange={(event) => {
                                const startTime = event.target.value;
                                setCustomShiftTimes((prev) => ({
                                  ...prev,
                                  [key]: {
                                    startTime,
                                    endTime: prev[key]?.endTime ?? '',
                                  },
                                }));
                              }}
                              disabled={!canEdit}
                              className="input-field text-sm w-28"
                            />
                            <span className="text-xs text-theme-muted">-</span>
                            <input
                              type="time"
                              value={customShiftTimes[key]?.endTime ?? ''}
                              onChange={(event) => {
                                const endTime = event.target.value;
                                setCustomShiftTimes((prev) => ({
                                  ...prev,
                                  [key]: {
                                    startTime: prev[key]?.startTime ?? '',
                                    endTime,
                                  },
                                }));
                              }}
                              disabled={!canEdit}
                              className="input-field text-sm w-28"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedDates((prev) => prev.filter((d) => toIsoDate(d) !== key))}
                          className="p-1.5 text-theme-muted hover:text-theme-primary hover:bg-theme-surface-muted rounded-lg"
                          title="Quitar dia"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {errors.branchId && <p className="text-xs text-red-500 mt-1">{errors.branchId.message}</p>}

            {/* Department (GM can select, DM is auto-assigned) */}
            {user?.role?.name === 'general_manager' && (
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">
                  Departamento
                </label>
                <select
                  {...register('departmentId')}
                  className="input-field text-sm"
                >
                  <option value="">Sin departamento</option>
                  {(departments as Array<{ id: string; name: string }>).map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Hidden field for DM - auto-assigned */}
            {user?.role?.name === 'department_manager' && resolvedDepartmentId && (
              <input type="hidden" {...register('departmentId')} value={resolvedDepartmentId} />
            )}

            {/* Live preview */}
            {preview && (
              <div className="flex items-start gap-3 p-3.5 bg-theme-surface-muted border border-theme-color rounded-xl">
                <Info className="h-4 w-4 text-theme-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-theme-primary">
                    {preview.days} día{preview.days !== 1 ? 's' : ''} seleccionado{preview.days !== 1 ? 's' : ''}
                    {' '}· <span className="text-gray-900 font-bold">{preview.totalHours} h totales</span>
                  </p>
                  <p className="text-xs text-theme-muted mt-0.5">
                    {selectedBranchName ? ` · Sucursal ${selectedBranchName}` : ''}
                    {preview.holidayHits > 0 ? ` · ${preview.holidayHits} festivo(s) en días seleccionados` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">
                <MapPin className="inline h-3.5 w-3.5 mr-1" />Ubicación
              </label>
              <input {...register('location')} className="input-field" placeholder="Ej: Puesto Norte" disabled={!canEdit} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">
                <FileText className="inline h-3.5 w-3.5 mr-1" />Notas
              </label>
              <textarea {...register('notes')} className="input-field resize-none" rows={2} placeholder="Observaciones adicionales" disabled={!canEdit} />
            </div>

              {/* Assignees (mobile/tablet) */}
              {canEdit && users && (
              <div className="lg:hidden">
                <label className="block text-sm font-medium text-theme-muted mb-2">
                  <Users className="inline h-3.5 w-3.5 mr-1" />Personal asignado *
                  <span className="ml-1 text-xs text-theme-muted">({selectedUsers.length} seleccionados)</span>
                </label>
                <div className="border border-theme-color rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {assigneesContent}
                </div>
              </div>
            )}

            {/* Reason (for edits) */}
            {schedule && canEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Motivo del cambio</label>
                <input {...register('reason')} className="input-field" placeholder="Ej: Cambio de última hora por bajas" />
              </div>
            )}

            {canEdit && (
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 btn-ghost text-sm">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoading && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
                  {schedule ? 'Guardar cambios' : 'Crear Turno'}
                </button>
              </div>
            )}
            </form>

            {canEdit && users && (
              <aside className="hidden lg:flex min-h-0 border-l border-theme-color bg-theme-surface-muted/20 flex-col">
                <div className="px-5 py-4 border-b border-theme-color bg-theme-surface space-y-3">
                  <p className="text-sm font-medium text-theme-muted">
                    <Users className="inline h-3.5 w-3.5 mr-1" />Personal asignado *
                    <span className="ml-1 text-xs text-theme-muted">({selectedUsers.length} seleccionados)</span>
                  </p>
                  {/* Filtros */}
                <div className={`grid gap-2 ${canFilterBranch && canFilterDepartment ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {canFilterBranch && (
                    <select
                      value={asideBranchFilter}
                      onChange={(e) => setAsideBranchFilter(e.target.value)}
                      className="text-xs border border-theme-color rounded-lg px-2 py-1.5 text-theme-primary bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="">Todas las sucursales</option>
                      {(branches ?? []).map((b: { id: string; name: string }) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                  {canFilterDepartment && (
                    <select
                      value={asideDeptFilter}
                      onChange={(e) => setAsideDeptFilter(e.target.value)}
                      className="text-xs border border-theme-color rounded-lg px-2 py-1.5 text-theme-primary bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="">Todos los dptos.</option>
                      {departmentOptions.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                  <input
                    type="text"
                    value={asideSearchFilter}
                    onChange={(e) => setAsideSearchFilter(e.target.value)}
                    placeholder="Buscar por nombre o email..."
                    className="w-full text-xs border border-theme-color rounded-lg px-2 py-1.5 text-theme-primary bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {assigneesContent}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar Turno"
        description={`¿Estás seguro de eliminar "${schedule?.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate('Eliminada por el administrador')}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmSplit}
        title="Dividir Turno"
        description={`Se va a dividir el turno "${schedule?.title}" en ${pendingSplitPayload?.items.length ?? 0} turnos independientes. Los asignados recibirán notificaciones de los cambios.`}
        confirmLabel="Dividir"
        loading={deleteMutation.isPending || createBulkMutation.isPending}
        onConfirm={confirmSplitHandler}
        onCancel={cancelSplitDialog}
      />

      {holidayConflicts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-amber-100 bg-amber-50 rounded-t-2xl">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800">Festivos detectados</h3>
                <p className="text-xs text-amber-600 mt-0.5">
                  Hay festivos configurados para la sucursal en el periodo seleccionado
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-72 overflow-y-auto">
              {holidayConflicts.map((holiday) => (
                <div key={holiday.id} className="flex items-center gap-2 text-xs text-theme-muted">
                  <span className="font-mono text-theme-muted">{holiday.date.slice(0, 10)}</span>
                  <span className="truncate flex-1">{holiday.name}</span>
                  <span
                    className="shrink-0 px-1.5 py-0.5 rounded-full text-white font-medium"
                    style={{ backgroundColor: HOLIDAY_COLORS[holiday.type], fontSize: '9px' }}
                  >
                    {HOLIDAY_TYPE_LABELS[holiday.type]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <button
                type="button"
                onClick={cancelConflictDialog}
                className="flex-1 btn-ghost text-sm"
              >
                Revisar fechas
              </button>
              <button
                type="button"
                onClick={confirmDespiteHolidays}
                disabled={isLoading}
                className="flex-1 text-sm px-4 py-2 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
                Confirmar igualmente
              </button>
            </div>
          </div>
        </div>
      )}

      <UserProfileModal
        open={profileModalOpen}
        user={selectedProfileUser}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}

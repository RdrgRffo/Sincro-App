import { useEffect, useMemo, useRef, useState } from 'react';

import { CalendarDays, Save, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/config/api';
import type { BranchHoliday, CalendarBranchHoliday } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { getApiErrorMessage } from '@/lib/apiError';

interface HolidayEditModalProps {
  open: boolean;
  holiday: CalendarBranchHoliday | null;
  branchName?: string;
  onClose: () => void;
}

const HOLIDAY_TYPE_LABELS: Record<BranchHoliday['type'], string> = {
  nacional: 'Nacional',
  autonomica: 'Autonomica',
  local: 'Local',
  mejora: 'Mejora convenio',
  regional: 'Regional',
  company: 'Empresa',
};

function isGroupedHoliday(holiday: CalendarBranchHoliday): holiday is Extract<CalendarBranchHoliday, { holidayIds: string[] }> {
  return 'holidayIds' in holiday;
}

export function HolidayEditModal({ open, holiday, branchName, onClose }: HolidayEditModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(() => holiday?.name ?? '');
  const [date, setDate] = useState(() => holiday?.date?.slice(0, 10) ?? '');
  const [type, setType] = useState<BranchHoliday['type']>(() => holiday?.type ?? 'local');

  const prevHolidayIdRef = useRef(holiday?.id);
  useEffect(() => {
    if (holiday && holiday.id !== prevHolidayIdRef.current) {
      setName(holiday.name ?? '');
      setDate(holiday.date.slice(0, 10) ?? '');
      setType(holiday.type ?? 'local');
    }
    prevHolidayIdRef.current = holiday?.id;
  }, [holiday]);

  const canSave = useMemo(() => Boolean(name.trim()) && Boolean(date), [name, date]);


  const groupedHoliday = holiday && isGroupedHoliday(holiday) ? holiday : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!holiday) return;
      if (groupedHoliday) {
        await api.patch('/branches/all/holidays/bulk', {
          holidayIds: groupedHoliday.holidayIds,
          name: name.trim(),
          date,
          type,
        });
        return;
      }

      await api.patch(`/branches/${holiday.branchId}/holidays/${holiday.id}`, {
        name: name.trim(),
        date,
        type,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-holidays'] });
      qc.invalidateQueries({ queryKey: ['branch-holidays-calendar'] });
      toast.success('Festivo actualizado');
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar el festivo'));
    },
  });

  if (!open || !holiday) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-color">
          <div>
            <h3 className="text-base font-semibold text-theme-primary">Editar festivo</h3>
            {branchName && <p className="text-xs text-theme-muted mt-0.5">{branchName}</p>}
            {groupedHoliday && (
              <p className="text-[11px] text-theme-muted mt-0.5">
                Se aplicará a {groupedHoliday.holidayIds.length} sucursales.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-muted"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="p-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave || mutation.isPending) return;
            mutation.mutate();
          }}
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1">Fecha</label>
            <div className="relative">
              <input
                type="date"
                className="input-field pr-9"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1">Nombre</label>
            <input
              className="input-field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del festivo"
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1">Tipo</label>
            <select
              className="input-field"
              value={type}
              onChange={(event) => setType(event.target.value as BranchHoliday['type'])}
            >
              {(Object.keys(HOLIDAY_TYPE_LABELS) as BranchHoliday['type'][]).map((key) => (
                <option key={key} value={key}>
                  {HOLIDAY_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-ghost text-sm flex-1" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave || mutation.isPending}
              className="btn-primary text-sm flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {mutation.isPending ? (
                <LoadingSpinner size="sm" className="border-white border-t-white/40" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

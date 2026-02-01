import { useState } from 'react';
import { useCreateAbsence, useCancelAbsence } from '@/hooks/useAbsences';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError'; // Keep this import
import { X, CalendarDays } from 'lucide-react'; // Add CalendarDays
import type { AbsenceKind } from '@/types';
import { ABSENCE_KIND_OPTIONS } from '@/lib/absenceKinds';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AbsenceRequestModal({ open, onClose }: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [absenceType, setAbsenceType] = useState<AbsenceKind>('vacaciones');
  const [note, setNote] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<{
    visible: boolean;
    absenceId: string;
    employees: Array<{ id: string; name: string; email: string }>;
  }>({ visible: false, absenceId: '', employees: [] });

  const createMutation = useCreateAbsence();
  const cancelMutation = useCancelAbsence();

  if (!open) return null;

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecciona las fechas de inicio y fin');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      toast.error('La fecha de fin debe ser igual o posterior a la de inicio');
      return;
    }

    const dayStart = start.getDay();
    const dayEnd = end.getDay();
    if (dayStart === 0 || dayStart === 6) {
      toast.error('La fecha de inicio debe ser un día laborable (lunes a viernes)');
      return;
    }
    if (dayEnd === 0 || dayEnd === 6) {
      toast.error('La fecha de fin debe ser un día laborable (lunes a viernes)');
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        type: absenceType,
        note: note.trim() || undefined,
      });

      if (result.hasOverlap && result.overlappingEmployees.length > 0) {
        setOverlapWarning({
          visible: true,
          absenceId: result.id,
          employees: result.overlappingEmployees,
        });
        toast.success('Solicitud creada (colindante: solapa con el equipo)');
      } else {
        toast.success('Solicitud de ausencia creada');
        resetForm();
        onClose();
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la solicitud'));
    }
  };

  const handleOverlapConfirm = async () => {
    toast.success('Solicitud creada (colindante: solapa con el equipo)');
    resetForm();
    onClose();
  };

  const handleOverlapCancel = async () => {
    try {
      await cancelMutation.mutateAsync(overlapWarning.absenceId);
      toast.success('Solicitud cancelada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cancelar la solicitud'));
    }
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setAbsenceType('vacaciones');
    setNote('');
    setOverlapWarning({ visible: false, absenceId: '', employees: [] });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (overlapWarning.visible) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-bold text-theme-primary">Aviso de solapamiento</h2>
            <button type="button" onClick={handleClose} className="text-theme-muted hover:text-theme-primary">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
            <p className="font-medium">Tus fechas coinciden con las ausencias de:</p>
            <ul className="list-disc list-inside space-y-1">
              {overlapWarning.employees.map((emp) => (
                <li key={emp.id}>
                  {emp.name} ({emp.email})
                </li>
              ))}
            </ul>
            <p className="mt-2 text-amber-700">
              La solicitud quedó en estado <strong>colindante</strong> (solapa con compañeros del mismo departamento; se gestiona como pendiente para aprobar o cancelar).
              ¿Deseas mantenerla?
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={handleOverlapCancel} className="btn-secondary text-sm">
              Cancelar solicitud
            </button>
            <button type="button" onClick={handleOverlapConfirm} className="btn-primary text-sm">
              Mantener solicitud
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-theme-primary">Solicitar ausencia</h2>
            <p className="text-sm text-theme-muted mt-0.5">
              Selecciona las fechas para tu solicitud
            </p>
          </div>
          <button type="button" onClick={handleClose} className="text-theme-muted hover:text-theme-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">
              Tipo de ausencia *
            </label>
            <select
              value={absenceType}
              onChange={(e) => setAbsenceType(e.target.value as AbsenceKind)}
              className="input-field w-full text-sm"
            >
              {ABSENCE_KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">
              Fecha de inicio *
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field w-full pr-9" // Added pr-9
                min={new Date().toISOString().split('T')[0]}
              />
              <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">
              Fecha de fin *
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field w-full pr-9" // Added pr-9
                min={startDate || new Date().toISOString().split('T')[0]}
              />
              <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">
              Nota (opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field w-full resize-none"
              rows={3}
              maxLength={500}
              placeholder="Motivo o comentario..."
            />
            <p className="text-xs text-theme-muted mt-1 text-right">{note.length}/500</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={handleClose} className="btn-secondary text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !startDate || !endDate}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'Enviando...' : 'Solicitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

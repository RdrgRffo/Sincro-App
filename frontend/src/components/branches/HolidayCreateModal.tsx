import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, CalendarDays, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Branch, BranchHoliday } from '@/types';


type HolidayType = BranchHoliday['type'];

const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  nacional: 'Nacional',
  autonomica: 'Autonómica',
  local: 'Local',
  mejora: 'Mejora',
  regional: 'Regional',
  company: 'Empresa',
};

interface HolidayCreateModalProps {
  open: boolean;
  onClose: () => void;
  defaultBranchId?: string;
}

interface ConflictingSchedule {
  id: string;
  title: string;
  startDatetime: string;
  endDatetime: string;
  type: string;
  assignees: { id: string; name: string }[];
}

interface HolidayCreateResponse {
  holiday: BranchHoliday;
  warning?: string;
  conflictingSchedules?: ConflictingSchedule[];
}

export function HolidayCreateModal({ open, onClose, defaultBranchId }: HolidayCreateModalProps) {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<HolidayType>('local');
  const [targetBranchId, setTargetBranchId] = useState(defaultBranchId || 'all');
  const [warningData, setWarningData] = useState<{ warning: string; schedules: ConflictingSchedule[] } | null>(null);

  const { data: branches } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'holiday-create-modal'],
    queryFn: () => api.get('/branches', { params: { includeInactive: false } }).then((r) => r.data),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = { date, name: name.trim(), type };
      if (targetBranchId === 'all') {
        const activeBranches = branches?.data ?? [];
        if (activeBranches.length === 0) {
          throw new Error('No hay sucursales activas disponibles');
        }
        const results = await Promise.allSettled(
          activeBranches.map((branch) => api.post(`/branches/${branch.id}/holidays`, payload)),
        );
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
          const successCount = results.length - failed.length;
          if (successCount > 0) {
            toast.success(`Festivo creado en ${successCount} sucursal${successCount !== 1 ? 'es' : ''}`);
          }
          throw new Error(`No se pudo crear en ${failed.length} sucursal${failed.length !== 1 ? 'es' : ''}`);
        }
        return null;
      }
      const response = await api.post(`/branches/${targetBranchId}/holidays`, payload);
      return response.data.data as HolidayCreateResponse;

    },
    onSuccess: (data: HolidayCreateResponse | null) => {
      qc.invalidateQueries({ queryKey: ['branch-holidays'] });
      qc.invalidateQueries({ queryKey: ['branch-holidays-calendar'] });

      if (data?.warning && data?.conflictingSchedules && data.conflictingSchedules.length > 0) {
        setWarningData({
          warning: data.warning,
          schedules: data.conflictingSchedules,
        });
        return;
      }

      toast.success('Festivo creado');
      setDate('');
      setName('');
      setType('local');
      onClose();
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo crear el festivo')),
  });

  const handleDismissWarning = () => {
    setWarningData(null);
    setDate('');
    setName('');
    setType('local');
    onClose();
  };


  const handleSubmit = () => {
    if (!date || !name.trim()) {
      toast.error('Fecha y nombre son obligatorios');
      return;
    }
    createMutation.mutate();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
        <div className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up max-h-[calc(100vh-2rem)] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-theme-color flex-shrink-0">
            <h2 className="text-lg font-semibold text-theme-primary">Nuevo festivo</h2>
            <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Sucursal destino</label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="input-field"
              >
                <option value="all">Todas las sucursales</option>
                {(branches?.data ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Fecha *</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field pr-9"
                />
                <CalendarDays className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Nombre *</label>
              <input
                type="text"
                placeholder="Nombre del festivo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as HolidayType)}
                className="input-field"
              >
                {Object.entries(HOLIDAY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-theme-color">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost text-sm">Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {createMutation.isPending ? (
                <LoadingSpinner size="sm" className="border-white border-t-white/30" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear festivo
            </button>
          </div>
        </div>
      </div>

      {/* Popup de advertencia por schedules conflictivos */}
      {warningData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="card rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-theme-color flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-theme-primary">Aviso: turnos existentes</h2>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <p className="text-sm text-theme-muted">{warningData.warning}</p>

              <div className="space-y-2">
                {warningData.schedules.map((schedule) => (
                  <div key={schedule.id} className="p-3 rounded-lg bg-theme-bg border border-theme-color text-sm">
                    <div className="font-medium text-theme-primary">{schedule.title}</div>
                    <div className="text-theme-muted mt-1">
                      {new Date(schedule.startDatetime).toLocaleString('es-ES', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(schedule.endDatetime).toLocaleString('es-ES', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                    {schedule.assignees.length > 0 && (
                      <div className="text-theme-muted mt-1">
                        Asignados: {schedule.assignees.map((a) => a.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-theme-color">
              <button
                onClick={handleDismissWarning}
                className="flex-1 btn-primary text-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

}

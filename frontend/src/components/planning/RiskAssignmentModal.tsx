import { useState, useMemo } from 'react';
import { X, Search, Check, Clock, AlertTriangle, ShieldOff } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermission } from '@/hooks/usePermissions';
import type { CoverageRiskItem, PlanningSkill } from '@/hooks/usePlanning';
import type { User } from '@/types';

type Props = {
  risk: CoverageRiskItem | null;
  onClose: () => void;
};

const PAGE_SIZE = 20;

function statusLabel(status?: string) {
  if (status === 'available') return 'Libre';
  if (status === 'absence') return 'Ausente';
  if (status === 'busy') return 'Ocupado';
  return 'Pendiente';
}

function statusColor(status?: string) {
  if (status === 'available') return 'text-green-700 bg-green-50 border-green-200';
  if (status === 'absence') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (status === 'busy') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-slate-500 bg-slate-50 border-slate-200';
}

export function RiskAssignmentModal({ risk, onClose }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // 5.1: Validate schedules:update permission
  const canAssign = usePermission('schedules:update');

  // Fetch active users — request backend-scoped list by passing department/branch when available
  // 1.1: Fetch schedule detail with error handling for 403/404
  const {
    data: scheduleDetail,
    error: scheduleError,
    isError: scheduleIsError,
  } = useQuery({
    queryKey: ['schedule', risk?.schedule.id],
    queryFn: () =>
      api.get<{ data: { departmentId?: string; department?: { id: string; name: string } | null; assignments: Array<{ user: { id: string } }> } }>(
        `/schedules/${risk!.schedule.id}`,
      ),
    enabled: !!risk,
    retry: false,
  });

  const scheduleDepartmentId = useMemo(() => scheduleDetail?.data.data.departmentId ?? undefined, [
    scheduleDetail?.data?.data?.departmentId,
  ]);

  // Fetch active users — request backend-scoped list by passing department/branch when available
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'active', 'risk-assignment', scheduleDepartmentId, risk?.schedule.branch?.id],
    queryFn: () =>
      api
        .get<{ data: User[] }>('/users', {
          params: {
            limit: 500,
            status: 'active',
            departmentId: scheduleDepartmentId ?? undefined,
            branchId: risk?.schedule.branch?.id ?? undefined,
          },
        })
        .then((r) => r.data.data),
    enabled: !!risk,
  });

  // 5.2: Fetch real availability for workers in the schedule's time range
  const scheduleStart = risk ? new Date(risk.schedule.startDatetime) : null;
  const scheduleEnd = risk ? new Date(risk.schedule.endDatetime) : null;

  const { data: availabilityData } = useQuery({
    queryKey: ['planning', 'availability', risk?.schedule.id, scheduleStart?.toISOString(), scheduleEnd?.toISOString()],
    queryFn: async () => {
      if (!scheduleStart || !scheduleEnd) return [];
      const response = await api.get<{ data: Array<{ userId: string; status: 'available' | 'busy' | 'absence' }> }>(
        '/planning/availability',
        {
          params: {
            from: scheduleStart.toISOString(),
            to: scheduleEnd.toISOString(),
            scheduleId: risk!.schedule.id,
          },
        },
      );
      return response.data.data;
    },
    enabled: !!risk && !!scheduleStart && !!scheduleEnd,
    staleTime: 30_000,
  });

  const availabilityMap = useMemo(() => {
    const map = new Map<string, 'available' | 'busy' | 'absence'>();
    if (Array.isArray(availabilityData)) {
      for (const item of availabilityData) {
        map.set(item.userId, item.status);
      }
    }
    return map;
  }, [availabilityData]);


  
  const existingAssigneeIds = useMemo(
    () => scheduleDetail?.data.data.assignments.map((a) => a.user.id) ?? [],
    [scheduleDetail],
  );

  // Filter workers based on department + real availability
  const eligibleWorkers = useMemo(() => {
    if (!risk || allUsers.length === 0) return [];

    return allUsers
      .filter((user) => {
        // Exclude already assigned users
        if (existingAssigneeIds.includes(user.id)) return false;

        // Filter by department if schedule has a departmentId
        if (scheduleDepartmentId && user.department?.id !== scheduleDepartmentId) {
          return false;
        }

        return user.status === 'active';
      })
      .map((user) => {
        // 5.2: Use real availability status from backend
        const realStatus = availabilityMap.get(user.id) ?? 'available';
        return {
          userId: user.id,
          userName: user.name,
          email: user.email,
          branch: user.branch ?? null,
          department: user.department ?? null,
          skills: (user.skills ?? []).map((s) => ({
            id: s.skill.id,
            name: s.skill.name,
            category: s.skill.category ?? null,
            color: s.skill.color,
          })) as PlanningSkill[],
          status: realStatus as 'available' | 'busy' | 'absence',
          days: [] as Array<{ date: string; status: 'available' | 'busy' | 'absence' }>,
          matchedSkillCount: 0,
        };
      })
      .sort((a, b) => {
        // Prioritize available workers over busy/absence
        const statusOrder = { available: 0, busy: 1, absence: 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;

          // Then prioritize same-department workers
          const currentDept = scheduleDetail?.data.data.departmentId;
          if (currentDept) {
            const aSameDept = a.department?.id === currentDept ? 1 : 0;
            const bSameDept = b.department?.id === currentDept ? 1 : 0;
            if (aSameDept !== bSameDept) return bSameDept - aSameDept;
          }
        return b.matchedSkillCount - a.matchedSkillCount;
      });
  }, [risk, allUsers, scheduleDetail, scheduleDepartmentId, existingAssigneeIds, availabilityMap]);

  const filteredWorkers = useMemo(() => {
    if (!search.trim()) return eligibleWorkers;
    const q = search.toLowerCase();
    return eligibleWorkers.filter(
      (w) =>
        w.userName.toLowerCase().includes(q) ||
        w.branch?.name?.toLowerCase().includes(q) ||
        w.department?.name?.toLowerCase().includes(q),
    );
  }, [eligibleWorkers, search]);

  // 5.4: Pagination
  const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedWorkers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredWorkers.slice(start, start + PAGE_SIZE);
  }, [filteredWorkers, safePage]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const assignMutation = useMutation({
    mutationFn: async (assigneeIds: string[]) => {
      const allIds = [...new Set([...existingAssigneeIds, ...assigneeIds])];
      return api.patch(`/schedules/${risk!.schedule.id}`, {
        assigneeIds: allIds,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Personal asignado correctamente');
      onClose();
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error al asignar personal')),
  });

  const handleAssign = () => {
    if (selectedUserIds.length === 0) {
      toast.error('Selecciona al menos un trabajador');
      return;
    }
    assignMutation.mutate(selectedUserIds);
  };

  if (!risk) return null;

  // 1.1: Handle schedule fetch error (403/404)
  if (scheduleIsError) {
    const isForbidden = (scheduleError as { response?: { status?: number } })?.response?.status === 403;
    const isNotFound = (scheduleError as { response?: { status?: number } })?.response?.status === 404;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 text-center">
          <ShieldOff className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {isForbidden ? 'Acceso denegado' : 'Turno no encontrado'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {isForbidden
              ? 'No tienes permiso para ver este turno.'
              : isNotFound
                ? 'El turno solicitado no existe o ha sido eliminado.'
                : 'Ocurrió un error al cargar los datos del turno.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Asignar personal</h2>
            <p className="text-sm text-slate-500 mt-0.5">{risk.schedule.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Schedule info */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>
              {scheduleStart?.toLocaleDateString('es', { day: 'numeric', month: 'short' })}{' '}
              {scheduleStart?.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {scheduleEnd?.toLocaleDateString('es', { day: 'numeric', month: 'short' })}{' '}
              {scheduleEnd?.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {/* 5.3: Show duration */}
          {scheduleStart && scheduleEnd && (
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span>
                Duración:{' '}
                {(() => {
                  const diffMs = scheduleEnd.getTime() - scheduleStart.getTime();
                  const hours = Math.floor(diffMs / 3600000);
                  const mins = Math.floor((diffMs % 3600000) / 60000);
                  return hours > 0
                    ? `${hours}h${mins > 0 ? ` ${mins}min` : ''}`
                    : `${mins}min`;
                })()}
              </span>
            </div>
          )}
          {scheduleDepartmentId && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span>Departamento: {scheduleDetail?.data?.data?.department?.name ?? scheduleDepartmentId}</span>
            </div>
          )}
          {risk.schedule.branch?.name && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              <span>Sucursal: {risk.schedule.branch.name}</span>
            </div>
          )}
          {risk.reasons.length > 0 && (
            <div className="flex items-start gap-2 mt-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{risk.reasons.join(' · ')}</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar trabajador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>

        {/* Workers list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1.5">
          {usersLoading && (
            <p className="text-sm text-slate-400 text-center py-8">Cargando trabajadores...</p>
          )}
          {!usersLoading && paginatedWorkers.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              {search.trim()
                ? 'No se encontraron trabajadores'
                : 'No hay trabajadores disponibles para este turno'}
            </p>
          )}
          {paginatedWorkers.map((worker) => {
            const isSelected = selectedUserIds.includes(worker.userId);
            return (
              <button
                key={worker.userId}
                type="button"
                onClick={() => toggleUser(worker.userId)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  isSelected
                    ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{worker.userName}</p>
                      {worker.matchedSkillCount > 0 && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {worker.matchedSkillCount} skill(s)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {worker.branch?.name ?? '-'} · {worker.department?.name ?? '-'}
                    </p>
                    {/* Skills */}
                    {(worker.skills ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(worker.skills ?? []).slice(0, 3).map((skill: PlanningSkill) => (
                          <span
                            key={skill.id}
                            className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                          >
                            {skill.name}
                          </span>
                        ))}
                        {(worker.skills ?? []).length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{(worker.skills ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor(worker.status)}`}
                    >
                      {statusLabel(worker.status)}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-slate-800" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 5.4: Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            {selectedUserIds.length > 0
              ? `${selectedUserIds.length} trabajador(es) seleccionado(s)`
              : 'Selecciona trabajadores para asignar'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            {/* 5.1: Disable assign button if user lacks schedules:update permission */}
            {canAssign ? (
              <button
                type="button"
                onClick={handleAssign}
                disabled={selectedUserIds.length === 0 || assignMutation.isPending}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignMutation.isPending ? 'Asignando...' : 'Asignar'}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed" title="No tienes permiso para asignar personal">
                <ShieldOff className="h-3.5 w-3.5" />
                Sin permiso
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateAbsence, useApproveAbsence } from '@/hooks/useAbsences';
import api from '@/config/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { getEffectiveBranchId } from '@/lib/branchSelection';
import { useAuthStore } from '@/store/authStore';
import { X, Building2, Layers, UserCircle2 } from 'lucide-react';
import type { AbsenceKind, Branch, Department, User } from '@/types';
import { ABSENCE_KIND_OPTIONS } from '@/lib/absenceKinds';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AbsenceCreateModal({ open, onClose }: Props) {
  const authUser = useAuthStore((s) => s.user);
  const roleName = authUser?.role?.name ?? 'employee';
  const isAdmin = roleName === 'admin';
  const isGeneralManager = roleName === 'general_manager';
  const isDepartmentManager = roleName === 'department_manager';

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [absenceType, setAbsenceType] = useState<AbsenceKind>('vacaciones');
  const [note, setNote] = useState('');

  const createMutation = useCreateAbsence();
  const approveMutation = useApproveAbsence();

  const userBranchId = authUser?.branchId ?? null;
  const userDepartmentId = authUser?.departmentId ?? null;

  const userVisibleBranchIds = useMemo(() => {
    const ids = [
      authUser?.branchId,
      ...(authUser?.visibleBranches?.map((item) => item.branch.id) ?? []),
    ].filter(Boolean) as string[];
    return [...new Set(ids)];
  }, [authUser?.branchId, authUser?.visibleBranches]);

  const { data: branchesData } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'absence-create', authUser?.id, roleName],
    queryFn: () => api.get('/branches', { params: { includeInactive: true } }).then((r) => r.data),
    enabled: open && Boolean(authUser),
  });

  const availableBranches = useMemo(() => branchesData?.data ?? [], [branchesData?.data]);

  const scopedBranches = useMemo(() => {
    if (isAdmin) return availableBranches;
    if (!userVisibleBranchIds.length) return [];
    return availableBranches.filter((b) => userVisibleBranchIds.includes(b.id));
  }, [isAdmin, availableBranches, userVisibleBranchIds]);

  const canSelectBranch = isAdmin || userVisibleBranchIds.length > 1;
  const defaultScopedBranchId = !isAdmin
    ? (userBranchId ?? scopedBranches[0]?.id ?? '')
    : '';

  const effectiveBranchForQueries = useMemo(() => {
    if (isAdmin) return selectedBranchId;
    if (isDepartmentManager) return userBranchId ?? '';
    return getEffectiveBranchId({
      branches: scopedBranches,
      selectedBranchId: canSelectBranch ? (selectedBranchId || defaultScopedBranchId) : undefined,
      assignedBranchId: canSelectBranch ? undefined : (userBranchId ?? undefined),
      fallbackStrategy: 'none',
    });
  }, [
    isAdmin,
    isDepartmentManager,
    selectedBranchId,
    scopedBranches,
    canSelectBranch,
    defaultScopedBranchId,
    userBranchId,
  ]);

  const { data: departmentsData } = useQuery<{ data: Department[] }>({
    queryKey: ['departments', 'absence-create', effectiveBranchForQueries, isDepartmentManager, userDepartmentId],
    queryFn: () =>
      api
        .get('/departments', {
          params: {
            includeInactive: false,
            branchId: effectiveBranchForQueries || undefined,
          },
        })
        .then((r) => r.data),
    enabled: open && Boolean(authUser) && (isAdmin || Boolean(effectiveBranchForQueries)),
  });

  const departments = departmentsData?.data ?? [];

  const effectiveDepartmentFilter = useMemo(() => {
    if (isDepartmentManager && userDepartmentId) return userDepartmentId;
    return selectedDepartmentId;
  }, [isDepartmentManager, userDepartmentId, selectedDepartmentId]);

  const usersQueryEnabled =
    open &&
    Boolean(authUser) &&
    ((isDepartmentManager && Boolean(userDepartmentId)) ||
      (isGeneralManager &&
        Boolean(effectiveBranchForQueries) &&
        Boolean(selectedDepartmentId)) ||
      (isAdmin && Boolean(selectedBranchId) && Boolean(selectedDepartmentId)));

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: [
      'users',
      'absence-create',
      effectiveBranchForQueries,
      effectiveDepartmentFilter,
      roleName,
    ],
    queryFn: () =>
      api
        .get('/users', {
          params: {
            ...(effectiveBranchForQueries ? { branchId: effectiveBranchForQueries } : {}),
            ...(effectiveDepartmentFilter ? { departmentId: effectiveDepartmentFilter } : {}),
            status: 'active',
          },
        })
        .then((r) => r.data),
    enabled: usersQueryEnabled,
  });

  const users = usersData?.data ?? [];

  const resetForm = useCallback(() => {
    setSelectedBranchId('');
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setStartDate('');
    setEndDate('');
    setAbsenceType('vacaciones');
    setNote('');
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedDepartmentId('');
    setSelectedUserId('');
  };

  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartmentId(departmentId);
    setSelectedUserId('');
  };

  const handleSubmit = async () => {
    if (!authUser) return;
    if (!selectedUserId || !startDate || !endDate) {
      toast.error('Selecciona un empleado y las fechas');
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
      const payload: {
        startDate: string;
        endDate: string;
        type: AbsenceKind;
        note?: string;
        employeeId?: string;
      } = {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        type: absenceType,
        note: note.trim() || undefined,
      };
      if (selectedUserId !== authUser.id) {
        payload.employeeId = selectedUserId;
      }

      const absence = await createMutation.mutateAsync(payload);

      await approveMutation.mutateAsync({ id: absence.id });

      toast.success('Ausencia creada y aprobada');
      resetForm();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron crear las ausencias'));
    }
  };

  const isPending = createMutation.isPending || approveMutation.isPending;

  const canPickEmployee = useMemo(() => {
    if (!authUser) return false;
    if (isDepartmentManager) return Boolean(userDepartmentId);
    if (isGeneralManager) return Boolean(effectiveBranchForQueries) && Boolean(selectedDepartmentId);
    if (isAdmin) return Boolean(selectedBranchId) && Boolean(selectedDepartmentId);
    return false;
  }, [
    authUser,
    isAdmin,
    isGeneralManager,
    isDepartmentManager,
    effectiveBranchForQueries,
    selectedDepartmentId,
    selectedBranchId,
    userDepartmentId,
  ]);

  if (!open || !authUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-theme-primary">Crear ausencia</h2>
            <p className="text-sm text-theme-muted mt-0.5">
              {isAdmin && 'Elige sucursal, departamento y empleado. Se crea y aprueba al guardar.'}
              {isGeneralManager &&
                'Elige departamento y empleado de tus sucursales. Se crea y aprueba al guardar.'}
              {isDepartmentManager &&
                'Solo empleados de tu departamento. Se crea y aprueba al guardar.'}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="text-theme-muted hover:text-theme-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {isAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  <Building2 className="inline h-3.5 w-3.5 mr-1" />
                  Sucursal *
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  <option value="">Selecciona sucursal…</option>
                  {availableBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  <Layers className="inline h-3.5 w-3.5 mr-1" />
                  Departamento *
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="input-field w-full text-sm"
                  disabled={!selectedBranchId}
                >
                  <option value="">{selectedBranchId ? 'Selecciona departamento…' : 'Primero sucursal'}</option>
                  {departments
                    .filter((d) => d.branches?.some((b) => b.branch.id === selectedBranchId))
                    .map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {isGeneralManager && (
            <div className="space-y-3">
              {canSelectBranch && (
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    <Building2 className="inline h-3.5 w-3.5 mr-1" />
                    Sucursal *
                  </label>
                  <select
                    value={selectedBranchId || defaultScopedBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    {scopedBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!canSelectBranch && userBranchId && (
                <div className="rounded-lg border border-theme-color px-3 py-2 bg-theme-surface-muted/40 text-xs">
                  <p className="text-[10px] font-semibold uppercase text-theme-muted mb-1">Sucursal</p>
                  <p className="font-medium text-theme-primary">
                    {scopedBranches.find((b) => b.id === userBranchId)?.name ?? 'Tu sucursal'}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  <Layers className="inline h-3.5 w-3.5 mr-1" />
                  Departamento *
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="input-field w-full text-sm"
                  disabled={!effectiveBranchForQueries}
                >
                  <option value="">
                    {effectiveBranchForQueries ? 'Selecciona departamento…' : 'Sin sucursal'}
                  </option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isDepartmentManager && (
            <div className="rounded-lg border border-theme-color px-3 py-2 bg-theme-surface-muted/40 text-xs">
              <p className="text-[10px] font-semibold uppercase text-theme-muted mb-1">Departamento</p>
              <p className="font-medium text-theme-primary">
                {authUser.department?.name ?? 'Tu departamento'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">
              <UserCircle2 className="inline h-3.5 w-3.5 mr-1" />
              Empleado *
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="input-field w-full text-sm"
              disabled={!canPickEmployee}
            >
              <option value="">{canPickEmployee ? 'Seleccionar…' : 'Completa sucursal y departamento'}</option>
              {users
                .filter((u) => u.id !== authUser.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.department ? ` — ${u.department.name}` : ''}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">Tipo de ausencia *</label>
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
            <label className="block text-sm font-medium text-theme-primary mb-1">Fecha de inicio *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">Fecha de fin *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field w-full"
              min={startDate || undefined}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1">Nota (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field w-full resize-none"
              rows={3}
              maxLength={500}
              placeholder="Comentario..."
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
            disabled={isPending || !selectedUserId || !startDate || !endDate}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {isPending ? 'Creando...' : 'Crear y aprobar'}
          </button>
        </div>
      </div>
    </div>
  );
}

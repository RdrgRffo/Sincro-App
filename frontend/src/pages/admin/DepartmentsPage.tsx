import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { EmptyState } from '@/components/common/EmptyState';
import { DetailPageSkeleton } from '@/components/common/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DepartmentList } from '@/components/departments/DepartmentList';
import { DepartmentForm } from '@/components/departments/DepartmentForm';
import { DepartmentDetail } from '@/components/departments/DepartmentDetail';
import { DepartmentMembersModal } from '@/components/departments/DepartmentMembersModal';
import { getApiErrorMessage } from '@/lib/apiError';
import { getEffectiveBranchId } from '@/lib/branchSelection';
import { useAuthStore } from '@/store/authStore';
import type { Branch, Department, User } from '@/types';

const emptyDepartmentForm = { name: '', code: '', description: '', branchIds: [] as string[] };

export function DepartmentsPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.name === 'admin';
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [showInactiveDepartments, setShowInactiveDepartments] = useState(false);
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [departmentToActivate, setDepartmentToActivate] = useState<Department | null>(null);
  const [departmentToDisable, setDepartmentToDisable] = useState<Department | null>(null);
  const [departmentToHardDelete, setDepartmentToHardDelete] = useState<Department | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const appliedPreselectRef = useRef(false);

  const { data: branches, isLoading: branchesLoading } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'departments-page'],
    queryFn: () => api.get('/branches', { params: { includeInactive: true } }).then((r) => r.data),
  });

  const effectiveSelectedBranchId = getEffectiveBranchId({
    branches: branches?.data,
    selectedBranchId,
    fallbackStrategy: 'first',
  });

  const { data: departments, isLoading: departmentsLoading } = useQuery<{ data: Department[] }>({
    queryKey: ['departments', effectiveSelectedBranchId, showInactiveDepartments],
    queryFn: () => api.get('/departments', {
      params: { branchId: effectiveSelectedBranchId, includeInactive: showInactiveDepartments },
    }).then((r) => r.data),
    enabled: Boolean(effectiveSelectedBranchId),
  });

  const { data: branchUsersData, isLoading: branchUsersLoading } = useQuery<{ data: User[] }>({
    queryKey: ['users', 'department-members', effectiveSelectedBranchId],
    queryFn: () => api.get('/users', { params: { branchId: effectiveSelectedBranchId, limit: 500 } }).then((r) => r.data),
    enabled: Boolean(effectiveSelectedBranchId),
  });

  const { data: departmentUsers, isLoading: usersLoading } = useQuery<{ data: Array<{ id: string; name: string; email: string }> }>({
    queryKey: ['departments-users', selectedDepartmentId],
    queryFn: () => api.get('/users', { params: { departmentId: selectedDepartmentId, limit: 200 } })
      .then((r) => ({ data: r.data.data.map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })) })),
    enabled: Boolean(selectedDepartmentId),
  });

  const selectedDepartment = useMemo(
    () => departments?.data?.find((d) => d.id === selectedDepartmentId) ?? null,
    [departments?.data, selectedDepartmentId],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const preselectBranch = searchParams.get('branchId');
    if (preselectBranch) {
      setSelectedBranchId(preselectBranch);
    }
  }, [searchParams]);

  useEffect(() => {
    if (appliedPreselectRef.current) return;
    const preselectDepartment = searchParams.get('departmentId');
    if (!preselectDepartment || !departments?.data?.length) return;
    const match = departments.data.find((department) => department.id === preselectDepartment);
    if (match) {
      setSelectedDepartmentId(match.id);
      setIsCreatingDepartment(false);
      setEditingDepartmentId(null);
      appliedPreselectRef.current = true;
    }
  }, [departments?.data, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Auto‑seleccionar el primer departamento al cargar la lista */
  /* eslint-disable react-hooks/set-state-in-effect */
  const autoSelectDoneRef = useRef(false);
  useEffect(() => {
    if (autoSelectDoneRef.current) return;
    if (appliedPreselectRef.current) return;
    if (isCreatingDepartment) return;
    if (!departments?.data?.length) return;
    if (selectedDepartmentId) return;
    autoSelectDoneRef.current = true;
    setSelectedDepartmentId(departments.data[0].id);
  }, [departments?.data, isCreatingDepartment, selectedDepartmentId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeDepartmentsCount = (departments?.data ?? []).filter((d) => d.isActive).length;
  const inactiveDepartmentsCount = Math.max((departments?.data?.length ?? 0) - activeDepartmentsCount, 0);

  const createDepartmentMutation = useMutation({
    mutationFn: () => api.post('/departments', {
      ...departmentForm,
      code: departmentForm.code.toUpperCase(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments', effectiveSelectedBranchId] });
      toast.success('Departamento creado');
      setDepartmentForm(emptyDepartmentForm);
      setIsCreatingDepartment(false);
      setEditingDepartmentId(null);
      setSelectedDepartmentId('');
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo crear el departamento')),
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: (departmentId: string) => {
      const body: Record<string, unknown> = {};
      if (departmentForm.name.trim()) body.name = departmentForm.name.trim();
      if (departmentForm.code.trim()) body.code = departmentForm.code.trim().toUpperCase();
      if (departmentForm.description) body.description = departmentForm.description;
      if (departmentForm.branchIds.length > 0) body.branchIds = departmentForm.branchIds;
      return api.patch(`/departments/${departmentId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments', effectiveSelectedBranchId] });
      toast.success('Departamento actualizado');
      setDepartmentForm(emptyDepartmentForm);
      setIsCreatingDepartment(false);
      setEditingDepartmentId(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo actualizar el departamento')),
  });

  const disableDepartmentMutation = useMutation({
    mutationFn: (departmentId: string) => api.delete(`/departments/${departmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments', effectiveSelectedBranchId] });
      toast.success('Departamento desactivado');
      setDepartmentToDisable(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo desactivar el departamento')),
  });

  const activateDepartmentMutation = useMutation({
    mutationFn: (departmentId: string) => api.patch(`/departments/${departmentId}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments', effectiveSelectedBranchId] });
      toast.success('Departamento reactivado');
      setDepartmentToActivate(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo reactivar el departamento')),
  });

  const hardDeleteDepartmentMutation = useMutation({
    mutationFn: (departmentId: string) => api.delete(`/departments/${departmentId}/permanent`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments', effectiveSelectedBranchId] });
      toast.success('Departamento eliminado definitivamente');
      setDepartmentToHardDelete(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo eliminar el departamento')),
  });

  const updateDepartmentMemberMutation = useMutation({
    mutationFn: ({ userId, departmentId }: { userId: string; departmentId: string }) =>
      api.patch(`/users/${userId}`, { departmentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
      qc.invalidateQueries({ queryKey: ['departments'], exact: false });
      qc.invalidateQueries({ queryKey: ['departments-users'], exact: false });
      toast.success('Integrante actualizado');
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo actualizar el integrante')),
  });

  const assignManagerMutation = useMutation({
    mutationFn: ({ departmentId, userId }: { departmentId: string; userId: string }) =>
      api.patch(`/departments/${departmentId}/manager`, { userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'], exact: false });
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo asignar el gerente de departamento')),
  });

  const removeManagerMutation = useMutation({
    mutationFn: ({ departmentId, userId }: { departmentId: string; userId: string }) =>
      api.delete(`/departments/${departmentId}/manager`, { data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'], exact: false });
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo remover el gerente')),
  });

  const departmentSaving = createDepartmentMutation.isPending || updateDepartmentMutation.isPending;
  const hasBranches = Boolean(branches?.data?.length);
  const hasDepartments = Boolean(departments?.data?.length);

  const handleSortChange = (field: 'name' | 'code', order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  const onSelectDepartment = (department: Department) => {
    setSelectedDepartmentId(department.id);
    setIsCreatingDepartment(false);
    setEditingDepartmentId(null);
  };

  const startNewDepartment = () => {
    setSelectedDepartmentId('');
    setIsCreatingDepartment(true);
    setEditingDepartmentId(null);
    setDepartmentForm({ ...emptyDepartmentForm, branchIds: effectiveSelectedBranchId ? [effectiveSelectedBranchId] : [] });
  };

  const cancelNewDepartment = () => {
    setIsCreatingDepartment(false);
    setEditingDepartmentId(null);
    setDepartmentForm(emptyDepartmentForm);
  };

  const startEditDepartment = (department: Department) => {
    setSelectedDepartmentId(department.id);
    setIsCreatingDepartment(true);
    setEditingDepartmentId(department.id);
    setDepartmentForm({
      name: department.name,
      code: department.code,
      description: department.description ?? '',
      branchIds: department.branches?.map((item) => item.branch.id) ?? [],
    });
  };

  const onSaveDepartment = () => {
    if (!departmentForm.name.trim() || !departmentForm.code.trim()) {
      toast.error('Nombre y codigo son obligatorios');
      return;
    }
    if (!departmentForm.branchIds.length) {
      toast.error('Debe seleccionar al menos una sucursal');
      return;
    }
    if (editingDepartmentId) {
      updateDepartmentMutation.mutate(editingDepartmentId);
      return;
    }
    createDepartmentMutation.mutate();
  };

  const selectedBranch = branches?.data?.find((branch) => branch.id === effectiveSelectedBranchId) ?? null;
  const branchUsers = branchUsersData?.data ?? [];
  const departmentUsersList = departmentUsers?.data ?? [];
  const otherDepartments = (departments?.data ?? []).filter((department) => department.id !== selectedDepartmentId);

  const handleAssignUser = (userId: string) => {
    if (!selectedDepartment) return;
    updateDepartmentMemberMutation.mutate({ userId, departmentId: selectedDepartment.id });
  };

  const handleMoveUser = (userId: string, departmentId: string) => {
    updateDepartmentMemberMutation.mutate({ userId, departmentId });
  };

  const handleAssignManager = (userId: string) => {
    if (!selectedDepartment) return;
    const dep = selectedDepartment;
    const userLabel =
      branchUsers.find((u) => u.id === userId)?.name
      ?? departmentUsersList.find((u) => u.id === userId)?.name
      ?? 'Usuario';
    assignManagerMutation.mutate(
      { departmentId: dep.id, userId },
      {
        onSuccess: () => {
          toast.success(`${userLabel} es ahora gerente de departamento (DM) de ${dep.name}`);
        },
      },
    );
  };

  const handleRemoveManager = (userId: string) => {
    if (!selectedDepartment) return;
    const dep = selectedDepartment;
    const userLabel =
      branchUsers.find((u) => u.id === userId)?.name
      ?? departmentUsersList.find((u) => u.id === userId)?.name
      ?? 'Usuario';
    removeManagerMutation.mutate(
      { departmentId: dep.id, userId },
      {
        onSuccess: () => {
          toast.success(`${userLabel} ya no es DM de ${dep.name}`);
        },
      },
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <section
        className="card border border-theme-color rounded-2xl p-5 sm:p-6 space-y-4"
        style={{ background: 'linear-gradient(140deg, var(--theme-surface), color-mix(in srgb, var(--theme-surface) 82%, var(--theme-sidebar-active-bg) 18%))' }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Administracion</p>
            <h1 className="text-2xl font-bold text-theme-primary mt-1">Departamentos</h1>
            <p className="text-sm text-theme-muted mt-1">Crea y organiza los departamentos por sede.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto">
            <StatBox label="Total" value={departments?.data?.length ?? 0} />
            <StatBox label="Activos" value={activeDepartmentsCount} />
            <StatBox label="Inactivos" value={inactiveDepartmentsCount} />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-theme-color bg-theme-surface px-3 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h2 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
              <Layers className="h-4 w-4" />Gestion de departamentos
            </h2>
            <label className="text-xs text-theme-muted flex items-center gap-2 rounded-lg border border-theme-color px-2.5 py-1.5 bg-theme-surface-muted/30">
              <input
                type="checkbox"
                checked={showInactiveDepartments}
                onChange={(e) => setShowInactiveDepartments(e.target.checked)}
                className="rounded border-theme-color"
              />
              Mostrar inactivos
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-muted">Sucursal</span>
            <select
              className="input-field text-sm min-w-55"
              value={effectiveSelectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={branchesLoading || !hasBranches}
            >
              {!hasBranches && <option value="">Sin sucursales</option>}
              {(branches?.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code}){branch.isActive ? '' : ' · inactiva'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card border border-theme-color rounded-2xl p-4 sm:p-5">
        {branchesLoading || departmentsLoading ? (
          <DetailPageSkeleton />
        ) : !hasBranches ? (
          <EmptyState icon={Layers} title="Sin sucursales" description="Crea una sucursal antes de gestionar departamentos" className="py-10" />
        ) : (
          <div className={`grid gap-4 lg:gap-5 ${hasDepartments ? 'grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
            <DepartmentList
              departments={departments?.data ?? []}
              selectedDepartmentId={selectedDepartmentId}
              isCreatingDepartment={isCreatingDepartment}
              searchTerm={searchTerm}
              sortBy={sortBy}
              sortOrder={sortOrder}
              canCreate={isAdmin}
              onSearchChange={setSearchTerm}
              onSortChange={handleSortChange}
              onSelectDepartment={onSelectDepartment}
              onNewDepartment={startNewDepartment}
            />

            <div className="rounded-xl border border-theme-color bg-theme-surface p-4 sm:p-5 space-y-4">
              {isCreatingDepartment ? (
                <DepartmentForm
                  form={departmentForm}
                  branches={branches?.data ?? []}
                  isEditing={!!editingDepartmentId}
                  isSaving={departmentSaving}
                  onChange={setDepartmentForm}
                  onSave={onSaveDepartment}
                  onCancel={cancelNewDepartment}
                />
              ) : selectedDepartment ? (
                <DepartmentDetail
                  department={selectedDepartment}
                  users={departmentUsers?.data ?? []}
                  usersLoading={usersLoading}
                  onEdit={() => startEditDepartment(selectedDepartment)}
                  onManageMembers={() => setShowMembersModal(true)}
                  onManageManagers={() => setShowMembersModal(true)}
                  onDisable={() => setDepartmentToDisable(selectedDepartment)}
                  onActivate={() => setDepartmentToActivate(selectedDepartment)}
                  onHardDelete={() => setDepartmentToHardDelete(selectedDepartment)}
                  isDisabling={disableDepartmentMutation.isPending}
                  isActivating={activateDepartmentMutation.isPending}
                  isDeleting={hardDeleteDepartmentMutation.isPending}
                />
              ) : (
                <EmptyState icon={Layers} title="Sin departamentos" description="Crea el primer departamento" className="py-10" />
              )}
            </div>
          </div>
        )}
      </section>

      {showMembersModal && selectedDepartment ? (
        <DepartmentMembersModal
          open={showMembersModal}
          department={selectedDepartment}
          branchName={selectedBranch?.name ?? 'Sucursal'}
          branchUsers={branchUsers}
          departmentUsers={departmentUsersList}
          departments={otherDepartments}
          isLoading={branchUsersLoading || updateDepartmentMemberMutation.isPending || assignManagerMutation.isPending || removeManagerMutation.isPending}
          onAssignUser={handleAssignUser}
          onMoveUser={handleMoveUser}
          onAssignManager={handleAssignManager}
          onRemoveManager={handleRemoveManager}
          onCancel={() => setShowMembersModal(false)}
        />
      ) : null}

      <ConfirmDialog
        open={!!departmentToActivate}
        title="Activar departamento"
        description={`Quieres activar "${departmentToActivate?.name ?? ''}"?`}
        confirmLabel="Activar"
        variant="warning"
        loading={activateDepartmentMutation.isPending}
        onConfirm={() => departmentToActivate && activateDepartmentMutation.mutate(departmentToActivate.id)}
        onCancel={() => setDepartmentToActivate(null)}
      />
      <ConfirmDialog
        open={!!departmentToDisable}
        title="Desactivar departamento"
        description={`Quieres desactivar "${departmentToDisable?.name ?? ''}"?`}
        confirmLabel="Desactivar"
        variant="warning"
        loading={disableDepartmentMutation.isPending}
        onConfirm={() => departmentToDisable && disableDepartmentMutation.mutate(departmentToDisable.id)}
        onCancel={() => setDepartmentToDisable(null)}
      />
      <ConfirmDialog
        open={!!departmentToHardDelete}
        title="Eliminar departamento definitivamente"
        description={`Esta accion eliminara "${departmentToHardDelete?.name ?? ''}" de forma permanente.`}
        confirmLabel="Eliminar definitivamente"
        variant="danger"
        loading={hardDeleteDepartmentMutation.isPending}
        onConfirm={() => departmentToHardDelete && hardDeleteDepartmentMutation.mutate(departmentToHardDelete.id)}
        onCancel={() => setDepartmentToHardDelete(null)}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-theme-color bg-theme-surface px-3 py-2 min-w-24">
      <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">{label}</p>
      <p className="text-lg font-bold text-theme-primary leading-tight">{value}</p>
    </div>
  );
}

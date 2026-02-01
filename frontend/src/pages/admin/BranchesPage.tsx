import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { DetailPageSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BranchList } from '@/components/branches/BranchList';
import { BranchForm } from '@/components/branches/BranchForm';
import { BranchDetail } from '@/components/branches/BranchDetail';
import { ManagerAssignmentModal } from '@/components/branches/ManagerAssignmentModal';
import { getApiErrorMessage } from '@/lib/apiError';
import { getEffectiveBranchId } from '@/lib/branchSelection';
import type { Branch, Department } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
const emptyBranchForm = { name: '', code: '', address: '', city: '', region: '', countryCode: 'ES', timezone: 'Europe/Madrid' };

export function BranchesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.name === 'admin';
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [showInactiveBranches, setShowInactiveBranches] = useState(false);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchToActivate, setBranchToActivate] = useState<Branch | null>(null);
  const [branchToDisable, setBranchToDisable] = useState<Branch | null>(null);
  const [branchToHardDelete, setBranchToHardDelete] = useState<Branch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [branchForManagerAssignment, setBranchForManagerAssignment] = useState<Branch | null>(null);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const { data: branches, isLoading: branchesLoading } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', showInactiveBranches],
    queryFn: () => api.get('/branches', { params: { includeInactive: showInactiveBranches } }).then((r) => r.data),
  });

  const effectiveSelectedBranchId = getEffectiveBranchId({
    branches: branches?.data, selectedBranchId, fallbackStrategy: 'first',
  });

  const selectedBranch = branches?.data?.find((b) => b.id === effectiveSelectedBranchId) ?? null;
  const activeBranchesCount = (branches?.data ?? []).filter((b) => b.isActive).length;
  const inactiveBranchesCount = Math.max((branches?.data?.length ?? 0) - activeBranchesCount, 0);

  const { data: departmentsData } = useQuery<{ data: Department[] }>({
    queryKey: ['departments', effectiveSelectedBranchId],
    queryFn: () => api.get('/departments', { params: { branchId: effectiveSelectedBranchId, includeInactive: true } }).then((r) => r.data),
    enabled: Boolean(effectiveSelectedBranchId),
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users', 'active', branchForManagerAssignment?.id],
    queryFn: () =>
      api.get('/users', {
        params: {
          status: 'active',
          branchId: branchForManagerAssignment?.id ?? undefined,
        },
      }).then((r) => r.data),
    enabled: !!branchForManagerAssignment,
  });
  const createBranchMutation = useMutation({
    mutationFn: () => api.post('/branches', { ...branchForm, code: branchForm.code.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Sucursal creada');
      setBranchForm(emptyBranchForm); setIsCreatingBranch(false); setEditingBranchId(null); setSelectedBranchId('');
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo crear la sucursal')),
  });

  const updateBranchMutation = useMutation({
    mutationFn: (branchId: string) => api.patch(`/branches/${branchId}`, { ...branchForm, code: branchForm.code.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Sucursal actualizada');
      setBranchForm(emptyBranchForm); setIsCreatingBranch(false); setEditingBranchId(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo actualizar la sucursal')),
  });

  const disableBranchMutation = useMutation({
    mutationFn: (branchId: string) => api.delete(`/branches/${branchId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); toast.success('Sucursal desactivada'); setBranchToDisable(null); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo desactivar la sucursal')),
  });

  const activateBranchMutation = useMutation({
    mutationFn: (branchId: string) => api.patch(`/branches/${branchId}/reactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); toast.success('Sucursal reactivada'); setBranchToActivate(null); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo reactivar la sucursal')),
  });

  const hardDeleteBranchMutation = useMutation({
    mutationFn: (branchId: string) => api.delete(`/branches/${branchId}/permanent`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] }); qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['branch-holidays'] }); qc.invalidateQueries({ queryKey: ['branch-holidays-calendar'] });
      toast.success('Sucursal eliminada definitivamente'); setBranchToHardDelete(null);
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo eliminar definitivamente la sucursal')),
  });

  const assignManagerMutation = useMutation({
    mutationFn: ({ branchId, userId }: { branchId: string; userId: string }) =>
      api.patch(`/branches/${branchId}/manager`, { userId }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
      // Refrescar authStore si el usuario asignado es el propio usuario logueado
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id === variables.userId) {
        api.get('/auth/me').then((r) => {
          useAuthStore.getState().setUser(r.data.data);
        }).catch(() => {});
      }
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo asignar el gerente')),
  });

  const removeManagerMutation = useMutation({
    mutationFn: (branchId: string) => api.delete(`/branches/${branchId}/manager`),
    onSuccess: (_data, branchId) => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['users'], exact: false });
      // Refrescar authStore si el manager removido es el propio usuario logueado
      const currentUser = useAuthStore.getState().user;
      const selectedBranch = branches?.data?.find((b) => b.id === branchId);
      if (currentUser?.id === selectedBranch?.managerId) {
        api.get('/auth/me').then((r) => {
          useAuthStore.getState().setUser(r.data.data);
        }).catch(() => {});
      }
      toast.success('Gerente general removido de la sucursal');
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo remover el gerente')),
  });

  const branchSaving = createBranchMutation.isPending || updateBranchMutation.isPending;
  const hasBranches = Boolean(branches?.data?.length);

  const handleSortChange = (field: 'name' | 'code', order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  const onSelectBranch = (branch: Branch) => { setSelectedBranchId(branch.id); setIsCreatingBranch(false); setEditingBranchId(null); };
  const startNewBranch = () => { setSelectedBranchId(''); setIsCreatingBranch(true); setEditingBranchId(null); setBranchForm(emptyBranchForm); };
  const cancelNewBranch = () => { setIsCreatingBranch(false); setEditingBranchId(null); setBranchForm(emptyBranchForm); };
  const startEditBranch = (branch: Branch) => {
    setSelectedBranchId(branch.id); setIsCreatingBranch(true); setEditingBranchId(branch.id);
    setBranchForm({ name: branch.name, code: branch.code, address: branch.address ?? '', city: branch.city ?? '', region: branch.region ?? '', countryCode: branch.countryCode, timezone: branch.timezone });
  };
  const onSaveBranch = () => {
    if (!branchForm.name.trim() || !branchForm.code.trim()) { toast.error('Nombre y código son obligatorios'); return; }
    if (editingBranchId) { updateBranchMutation.mutate(editingBranchId); return; }
    createBranchMutation.mutate();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="card border border-theme-color rounded-2xl p-5 sm:p-6 space-y-4"
        style={{ background: 'linear-gradient(140deg, var(--theme-surface), color-mix(in srgb, var(--theme-surface) 82%, var(--theme-sidebar-active-bg) 18%))' }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Administración</p>
            <h1 className="text-2xl font-bold text-theme-primary mt-1">Sucursales</h1>
            <p className="text-sm text-theme-muted mt-1">Gestiona ubicaciones, códigos y datos operativos de cada sede.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto">
            <StatBox label="Total" value={branches?.data?.length ?? 0} />
            <StatBox label="Activas" value={activeBranchesCount} />
            <StatBox label="Inactivas" value={inactiveBranchesCount} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-theme-color bg-theme-surface px-3 py-2.5">
          <h2 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
            <Building2 className="h-4 w-4" />Gestión de sucursales
          </h2>
          <label className="text-xs text-theme-muted flex items-center gap-2 rounded-lg border border-theme-color px-2.5 py-1.5 bg-theme-surface-muted/30">
            <input type="checkbox" checked={showInactiveBranches} onChange={(e) => setShowInactiveBranches(e.target.checked)} className="rounded border-theme-color" />
            Mostrar inactivas
          </label>
        </div>
      </section>

      <section className="card border border-theme-color rounded-2xl p-4 sm:p-5">
        {branchesLoading ? (
          <DetailPageSkeleton />
        ) : (
          <div className={`grid gap-4 lg:gap-5 ${hasBranches ? 'grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
            <BranchList
              branches={branches?.data ?? []}
              selectedBranchId={effectiveSelectedBranchId}
              isCreatingBranch={isCreatingBranch}
              searchTerm={searchTerm}
              sortBy={sortBy}
              sortOrder={sortOrder}
              canCreate={isAdmin}
              onSearchChange={setSearchTerm}
              onSortChange={handleSortChange}
              onSelectBranch={onSelectBranch}
              onNewBranch={startNewBranch}
            />

            <div className="rounded-xl border border-theme-color bg-theme-surface p-4 sm:p-5 space-y-4">
              {isCreatingBranch ? (
                <BranchForm
                  form={branchForm}
                  isEditing={!!editingBranchId}
                  isSaving={branchSaving}
                  onChange={setBranchForm}
                  onSave={onSaveBranch}
                  onCancel={cancelNewBranch}
                />
              ) : selectedBranch ? (
                <BranchDetail
                  branch={selectedBranch}
                  departments={(departmentsData?.data ?? []).map((department) => ({
                    id: department.id,
                    name: department.name,
                    code: department.code,
                    isActive: department.isActive,
                  }))}
                  onSelectDepartment={(departmentId) => {
                    navigate(`/admin/departments?branchId=${selectedBranch.id}&departmentId=${departmentId}`);
                  }}
                  onEdit={() => startEditBranch(selectedBranch)}
                  onDisable={() => setBranchToDisable(selectedBranch)}
                  onActivate={() => setBranchToActivate(selectedBranch)}
                  onHardDelete={() => setBranchToHardDelete(selectedBranch)}
                  onAssignManager={() => { setBranchForManagerAssignment(selectedBranch); setShowManagerModal(true); setSelectedManagerId(''); }}
                  onRemoveManager={() => removeManagerMutation.mutate(selectedBranch.id)}
                  isDisabling={disableBranchMutation.isPending}
                  isActivating={activateBranchMutation.isPending}
                  isDeleting={hardDeleteBranchMutation.isPending}
                  isAssigningManager={assignManagerMutation.isPending}
                  isRemovingManager={removeManagerMutation.isPending}
                />
              ) : (
                <EmptyState icon={Building2} title="Sin sucursales" description="Crea la primera sucursal" className="py-10" />
              )}
            </div>
          </div>
        )}
      </section>
      {showManagerModal && branchForManagerAssignment ? (
        <ManagerAssignmentModal
          open={showManagerModal}
          branch={branchForManagerAssignment}
          users={usersData?.data ?? []}
          selectedUserId={selectedManagerId}
          onSelectUser={setSelectedManagerId}
          onAssign={() => {
            const b = branchForManagerAssignment;
            const uid = selectedManagerId;
            if (!b || !uid) {
              toast.error('Selecciona un usuario');
              return;
            }
            assignManagerMutation.mutate(
              { branchId: b.id, userId: uid },
              {
                onSuccess: () => {
                  const cached = qc.getQueryData<{ data: User[] }>(['users', 'active']);
                  const name = cached?.data?.find((u) => u.id === uid)?.name ?? 'Usuario';
                  toast.success(`${name} es ahora gerente general (GM) de ${b.name}`);
                  setShowManagerModal(false);
                  setBranchForManagerAssignment(null);
                  setSelectedManagerId('');
                },
              },
            );
          }}
          onCancel={() => {
            setShowManagerModal(false);
            setBranchForManagerAssignment(null);
            setSelectedManagerId('');
          }}
          isLoading={assignManagerMutation.isPending}
        />
      ) : null}
      <ConfirmDialog open={!!branchToActivate} title="Activar sucursal" description={`¿Quieres activar "${branchToActivate?.name ?? ''}"?`}
        confirmLabel="Activar" variant="warning" loading={activateBranchMutation.isPending}
        onConfirm={() => branchToActivate && activateBranchMutation.mutate(branchToActivate.id)}
        onCancel={() => setBranchToActivate(null)} />
      <ConfirmDialog open={!!branchToDisable} title="Desactivar sucursal" description={`¿Quieres desactivar "${branchToDisable?.name ?? ''}"?`}
        confirmLabel="Desactivar" variant="warning" loading={disableBranchMutation.isPending}
        onConfirm={() => branchToDisable && disableBranchMutation.mutate(branchToDisable.id)}
        onCancel={() => setBranchToDisable(null)} />
      <ConfirmDialog open={!!branchToHardDelete} title="Eliminar sucursal definitivamente"
        description={`Esta acción eliminará "${branchToHardDelete?.name ?? ''}" de forma permanente. Solo es posible si no tiene turnos asociados.`}
        confirmLabel="Eliminar definitivamente" variant="danger" loading={hardDeleteBranchMutation.isPending}
        onConfirm={() => branchToHardDelete && hardDeleteBranchMutation.mutate(branchToHardDelete.id)}
        onCancel={() => setBranchToHardDelete(null)} />
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

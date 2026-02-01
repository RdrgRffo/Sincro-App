import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import type { Branch, Department, Skill, User } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

function actorBranchScopeIds(actor: User | null): string[] {
  if (!actor?.branchId) return [];
  const extras = actor.visibleBranches?.map((v) => v.branch.id) ?? [];
  return [...new Set([actor.branchId, ...extras].filter(Boolean))];
}

/** IDs almacenados en `user_visible_branch` (sucursales extra visibles, sin duplicar la sucursal base). */
function extraVisibleIdsFromUser(u: User | null | undefined): string[] {
  if (!u) return [];
  const base = u.branchId ?? '';
  return (u.visibleBranches?.map((item) => item.branch.id) ?? []).filter((id) => id && id !== base);
}

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal('')),
  departmentId: z.string().min(1, 'Debes seleccionar un departamento'),
  companyPhone: z.string().optional(),
  auxiliaryPhone: z.string().optional(),
  branchId: z.string().min(1, 'La sucursal es obligatoria'),
  skillIds: z.array(z.string()).optional().default([]),
  visibleBranchIds: z.array(z.string()).optional().default([]),
});

type FormData = z.infer<typeof schema>;
type FormDataInput = z.input<typeof schema>;

function normalizeFormData(data: FormDataInput): FormData {
  return {
    ...data,
    password: data.password ?? '',
    skillIds: data.skillIds ?? [],
    visibleBranchIds: data.visibleBranchIds ?? [],
  };
}

interface Props {
  open: boolean;
  user: User | null;
  roleName?: string;
  onClose: () => void;
}

export function UserFormModal({ open, user, roleName, onClose }: Props) {
  const actor = useAuthStore((s) => s.user);
  const actorRole = roleName ?? actor?.role?.name ?? 'employee';
  const isDepartmentManager = actorRole === 'department_manager';
  const isAdminActor = actorRole === 'admin';
  const isGeneralManagerActor = actorRole === 'general_manager';
  const canEditVisibleBranches = isAdminActor || isGeneralManagerActor;
  const scopeIds = useMemo(() => actorBranchScopeIds(actor), [actor]);
  const qc = useQueryClient();
  const isEdit = !!user;
  const [inactiveUserToReactivate, setInactiveUserToReactivate] = useState<{ id: string; name: string; email: string } | null>(null);

  const { data: branchesData, isLoading: branchesLoading } = useQuery<{ data: Branch[] }>({
    queryKey: ['branches', 'user-form'],
    queryFn: () => api.get('/branches', { params: { includeInactive: true } }).then((r) => r.data),
    enabled: open,
  });
  const branches = useMemo(() => branchesData?.data ?? [], [branchesData?.data]);

  const { data: skillsData, isLoading: skillsLoading } = useQuery<{ data: Skill[] }>({
    queryKey: ['skills', 'user-form'],
    queryFn: () => api.get('/skills').then((r) => r.data),
    enabled: open,
  });
  const skills = useMemo(() => skillsData?.data ?? [], [skillsData?.data]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormDataInput, unknown, FormData>({
    resolver: zodResolver(schema),
  });

  const selectedBranchId = watch('branchId');
  const skillIdsRaw = watch('skillIds');
  const selectedSkillIds = useMemo(() => skillIdsRaw ?? [], [skillIdsRaw]);

  const activeSkills = useMemo(() => skills.filter((s) => s.isActive), [skills]);

  const inactiveAssignedSkills = useMemo(
    () => skills.filter((s) => !s.isActive && selectedSkillIds.includes(s.id)),
    [skills, selectedSkillIds],
  );

  const skillsByCategory = useMemo(() => {
    const map = new Map<string, Skill[]>();
    activeSkills.forEach((skill) => {
      const key = skill.category || 'Sin categoría';
      map.set(key, [...(map.get(key) ?? []), skill]);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [activeSkills]);

  const toggleSkillId = (skillId: string) => {
    const current = getValues('skillIds') ?? [];
    const next = current.includes(skillId) ? current.filter((id) => id !== skillId) : [...current, skillId];
    setValue('skillIds', next, { shouldDirty: true, shouldValidate: true });
  };

  const { data: userDetailData } = useQuery<User>({
    queryKey: ['user-detail', user?.id],
    queryFn: () => api.get<{ data: User }>(`/users/${user!.id}`).then((r) => r.data.data),
    enabled: open && isEdit && Boolean(user?.id),
    retry: false,
  });
  const selectedUser = userDetailData ?? user;

  /** Sucursal efectiva para catálogos y UI cuando el select está bloqueado (DM) y `watch` puede ir vacío en tests/jsdom. */
  const effectiveBranchId = useMemo(
    () =>
      (typeof selectedBranchId === 'string' && selectedBranchId ? selectedBranchId : '') ||
      (isEdit ? (selectedUser?.branchId ?? user?.branchId ?? '') : ''),
    [selectedBranchId, isEdit, selectedUser?.branchId, user?.branchId],
  );

  const { data: departmentsData, isLoading: departmentsLoading } = useQuery<{ data: Department[] }>({
    queryKey: ['departments', 'user-form', effectiveBranchId],
    queryFn: () => api.get('/departments', { params: { branchId: effectiveBranchId, includeInactive: false } }).then((r) => r.data),
    enabled: open && Boolean(effectiveBranchId),
  });
  const departments = useMemo(() => departmentsData?.data ?? [], [departmentsData?.data]);

  useEffect(() => {
    if (selectedUser) {
      const currentDepartmentId = selectedUser.departmentId ?? selectedUser.department?.id ?? '';
      reset({
        name: selectedUser.name,
        email: selectedUser.email,
        departmentId: currentDepartmentId,
        companyPhone: selectedUser.companyPhone || '',
        auxiliaryPhone: selectedUser.auxiliaryPhone || '',
        branchId: selectedUser.branchId || '',
        skillIds: selectedUser.skills?.map((item) => item.skill.id) ?? [],
        visibleBranchIds: extraVisibleIdsFromUser(selectedUser),
      });
      return;
    }

    reset({
      name: '',
      email: '',
      password: '',
      departmentId: '',
      companyPhone: '',
      auxiliaryPhone: '',
      branchId: '',
      skillIds: [],
      visibleBranchIds: [],
    });
  }, [selectedUser, reset]);

  useEffect(() => {
    if (!effectiveBranchId) {
      setValue('departmentId', '', { shouldDirty: true });
      return;
    }
    if (departmentsLoading) return;
    // Con lista vacía, `.some()` es siempre false: no limpiar hasta tener catálogo real (evita borrar el valor del reset).
    if (departments.length === 0) return;
    const currentDepartmentId = getValues('departmentId');
    if (!currentDepartmentId) return;
    if (!departments.some((department) => department.id === currentDepartmentId)) {
      setValue('departmentId', '', { shouldDirty: true });
    }
  }, [effectiveBranchId, departments, departmentsLoading, setValue, getValues]);

  /** No duplicar la sucursal base en “visibles adicionales”. */
  useEffect(() => {
    if (!effectiveBranchId) return;
    const current = getValues('visibleBranchIds');
    if (!Array.isArray(current) || current.length === 0) return;
    const next = current.filter((id) => id !== effectiveBranchId);
    if (next.length !== current.length) {
      setValue('visibleBranchIds', next, { shouldDirty: true });
    }
  }, [effectiveBranchId, setValue, getValues]);

  const branchesForBaseSelect = useMemo(() => {
    if (isAdminActor) return branches;
    if (isGeneralManagerActor && scopeIds.length > 0) {
      return branches.filter((b) => scopeIds.includes(b.id));
    }
    return branches;
  }, [branches, isAdminActor, isGeneralManagerActor, scopeIds]);

  const visibleBranchSelectOptions = useMemo(() => {
    if (!effectiveBranchId) return [];
    const pool = branches.filter((b) => b.id !== effectiveBranchId);
    if (isGeneralManagerActor && scopeIds.length > 0) {
      return pool.filter((b) => scopeIds.includes(b.id));
    }
    return pool;
  }, [branches, isGeneralManagerActor, scopeIds, effectiveBranchId]);

  const dmExtraVisibleRows = useMemo(() => {
    if (!isDepartmentManager || !selectedUser?.visibleBranches?.length) return [];
    const base = selectedUser.branchId ?? '';
    return selectedUser.visibleBranches.filter((v) => v.branch.id !== base);
  }, [isDepartmentManager, selectedUser]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const baseBranchId = data.branchId;
      const extraVisible = (data.visibleBranchIds ?? []).filter((id) => id && id !== baseBranchId);

      const payload: Record<string, unknown> = {
        ...data,
        departmentIds: data.departmentId ? [data.departmentId] : [],
        branchId: data.branchId,
        skillIds: data.skillIds ?? [],
      };

      if (isDepartmentManager) {
        delete payload.visibleBranchIds;
      } else {
        payload.visibleBranchIds = extraVisible;
      }

      if (!isEdit) {
        return api.post('/users', payload);
      }

      const updatePayload = { ...payload };
      if (!updatePayload.password) delete updatePayload.password;
      await api.patch(`/users/${user!.id}`, updatePayload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(isEdit ? 'Usuario actualizado' : 'Usuario creado');
      setInactiveUserToReactivate(null);
      onClose();
    },
    onError: (e: unknown) => {
      // Detectar si el error es por email inactivo y permitir reactivación
      const response = e as { response?: { data?: { canReactivate?: boolean; existingUser?: { id: string; name: string; email: string } } } };
      if (response.response?.data?.canReactivate && response.response.data.existingUser) {
        setInactiveUserToReactivate(response.response.data.existingUser);
        toast.error('El email pertenece a un usuario inactivo. Puedes reactivarlo.');
      } else {
        toast.error(getApiErrorMessage(e, 'Error'));
      }
    },
  });

  // Mutation to assign skills via dedicated endpoint
  const assignSkillsMutation = useMutation({
    mutationFn: async ({ userId, skillIds }: { userId: string; skillIds: string[] }) => {
      return api.put(`/skills/users/${userId}`, { skillIds });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e, 'No se pudieron actualizar las skills'));
    },
  });

  // Local state to handle confirm flow when skills change
  const [pendingSubmitData, setPendingSubmitData] = useState<FormData | null>(null);
  const [confirmSkillsOpen, setConfirmSkillsOpen] = useState(false);

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/users/${userId}/reactivate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario reactivado');
      // Limpiar el estado y permitir que el formulario proceda
      setInactiveUserToReactivate(null);
      // Reintentar el envío del formulario
      mutation.mutate(normalizeFormData(getValues()));
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e, 'No se pudo reactivar el usuario'));
    },
  });

  if (!open) return null;

  // DM solo puede editar, no crear
  if (isDepartmentManager && !isEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
        <div className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up p-6 text-center">
          <h2 className="text-lg font-semibold text-theme-primary mb-2">Acción no permitida</h2>
          <p className="text-sm text-theme-muted mb-4">
            Como responsable de departamento no puedes crear nuevos usuarios. Contacta con un administrador o gerente general.
          </p>
          <button onClick={onClose} className="btn-primary text-sm">Cerrar</button>
        </div>
      </div>
    );
  }

  const onFormSubmit = (dataInput: FormDataInput) => {
    const data = normalizeFormData(dataInput);
    // Only prompt when editing existing user and skillIds differ
    if (isEdit) {
      const originalSkillIds = selectedUser?.skills?.map((s) => s.skill.id) ?? [];
      const nextSkillIds = data.skillIds ?? [];
      const same = originalSkillIds.length === nextSkillIds.length && originalSkillIds.every((id) => nextSkillIds.includes(id));
      if (!same) {
        setPendingSubmitData(data);
        setConfirmSkillsOpen(true);
        return;
      }
    }
    mutation.mutate(data);
  };

  const handleConfirmSkills = async () => {
    if (!pendingSubmitData) return;
    const formData = pendingSubmitData;
    setConfirmSkillsOpen(false);
    // First update core user fields (without forcing skills endpoint here)
    try {
      await mutation.mutateAsync(formData);
      if (isEdit && user?.id) {
        await assignSkillsMutation.mutateAsync({ userId: user.id, skillIds: formData.skillIds ?? [] });
      }
      onClose();
    } catch {
      // mutation handlers already show toasts
    } finally {
      setPendingSubmitData(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-color shrink-0">
          <h2 className="text-lg font-semibold text-theme-primary">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-4 overflow-y-auto flex-1">

          {isDepartmentManager && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Como responsable de departamento no puedes cambiar la sucursal ni el rol desde aquí. Puedes editar
              nombre, email, contraseña, departamento (dentro de los que gestionas), skills y teléfonos; el servidor
              rechaza si el usuario o el departamento quedan fuera de tu alcance.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Nombre completo *</label>
            <input {...register('name')} className="input-field" placeholder="Juan Garcia" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Email *</label>
            <input {...register('email')} type="email" className="input-field" placeholder="juan@dominio.com" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">
              Contraseña {isEdit ? '(dejar en blanco para no cambiar)' : '*'}
            </label>
            <input {...register('password')} type="password" className="input-field" placeholder="Minimo 8 caracteres" />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Sucursal *</label>
            <select
              {...register('branchId')}
              className={cn(
                'input-field',
                isDepartmentManager && 'pointer-events-none cursor-not-allowed opacity-80',
              )}
              disabled={branchesLoading}
              aria-disabled={isDepartmentManager || undefined}
              tabIndex={isDepartmentManager ? -1 : undefined}
            >
              <option value="" disabled>Selecciona una sucursal</option>
              {branchesForBaseSelect.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code}){branch.isActive ? '' : ' · inactiva'}
                </option>
              ))}
            </select>
            {errors.branchId && <p className="text-xs text-red-500 mt-1">{errors.branchId.message}</p>}
            {isDepartmentManager && <p className="text-[10px] text-theme-muted mt-0.5">No puedes cambiar la sucursal</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Departamento *</label>
            <select {...register('departmentId')} className="input-field" disabled={departmentsLoading || !effectiveBranchId}>
              <option value="" disabled>Selecciona un departamento</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name} ({department.code})
                </option>
              ))}
            </select>
            {errors.departmentId && <p className="text-xs text-red-500 mt-1">{errors.departmentId.message}</p>}
            {!effectiveBranchId && <p className="text-xs text-theme-muted mt-1">Primero selecciona una sucursal para ver los departamentos disponibles.</p>}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="min-w-0">
              <span className="block text-sm font-medium text-theme-muted mb-1">Skills</span>
              <p className="text-[10px] text-theme-muted mb-1.5">Marca las que aplican a este usuario.</p>
              {inactiveAssignedSkills.length > 0 ? (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                  <p className="font-medium mb-1.5">Asignadas pero inactivas en el catálogo (puedes quitarlas)</p>
                  <ul className="space-y-1.5">
                    {inactiveAssignedSkills.map((skill) => (
                      <li key={skill.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{skill.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-amber-900 underline font-medium"
                          onClick={() => toggleSkillId(skill.id)}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {skillsLoading ? (
                <div className="flex justify-center py-8 rounded-lg border border-theme-color bg-theme-surface-muted/30">
                  <LoadingSpinner size="sm" />
                </div>
              ) : activeSkills.length === 0 ? (
                <p className="text-xs text-theme-muted rounded-lg border border-dashed border-theme-color px-3 py-3">
                  No hay skills activas en el catálogo.
                </p>
              ) : (
                <div
                  className="max-h-52 overflow-y-auto rounded-lg border border-theme-color bg-theme-surface"
                  role="group"
                  aria-label="Skills del usuario"
                >
                  {skillsByCategory.map(([category, items]) => (
                    <div key={category}>
                      <div className="sticky top-0 z-1 bg-theme-surface-muted/95 backdrop-blur-sm border-b border-theme-color px-3 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-theme-muted">{category}</span>
                      </div>
                      <ul className="divide-y divide-theme-color">
                        {items.map((skill) => {
                          const checked = selectedSkillIds.includes(skill.id);
                          const inputId = `user-form-skill-${skill.id}`;
                          return (
                            <li key={skill.id}>
                              <label
                                htmlFor={inputId}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-theme-surface-muted/50 transition-colors"
                              >
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-theme-color text-gray-600 focus:ring-gray-500 shrink-0"
                                  checked={checked}
                                  onChange={() => toggleSkillId(skill.id)}
                                />
                                <span className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-theme-color/30" style={{ backgroundColor: skill.color }} />
                                <span className="text-sm text-theme-primary leading-snug">{skill.name}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canEditVisibleBranches ? (
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Sucursales visibles adicionales</label>
                {isGeneralManagerActor && (
                  <p className="text-[11px] text-theme-muted mb-1.5 rounded-lg border border-theme-color bg-theme-surface-muted/40 px-2 py-1.5">
                    Solo puedes asignar sedes dentro de tu alcance (tu sucursal base y las que ya tienes como visibles). La sucursal base ya da acceso a esa sede; aquí añades otras para consulta.
                  </p>
                )}
                {isAdminActor && (
                  <p className="text-[11px] text-theme-muted mb-1.5">
                    Opcional: sucursales extra que este usuario puede consultar además de su sucursal base (visibilidad de datos, no permisos de edición).
                  </p>
                )}
                {!effectiveBranchId ? (
                  <p className="text-xs text-theme-muted border border-dashed border-theme-color rounded-lg px-3 py-2">
                    Selecciona primero la sucursal base para elegir sucursales adicionales visibles.
                  </p>
                ) : (
                  <>
                    <select
                      {...register('visibleBranchIds')}
                      multiple
                      className="input-field min-h-24"
                      disabled={branchesLoading}
                    >
                      {visibleBranchSelectOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code}){branch.isActive ? '' : ' · inactiva'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-theme-muted mt-0.5">
                      Mantén Ctrl/Cmd para selección múltiple. No incluyas la sucursal base aquí.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">Sucursales visibles adicionales</label>
                <p className="text-[11px] text-theme-muted mb-1.5">
                  Solo administración o gerencia general pueden modificarlas. El usuario sigue viendo datos según lo configurado en el servidor.
                </p>
                {dmExtraVisibleRows.length === 0 ? (
                  <p className="text-xs text-theme-muted border border-theme-color rounded-lg px-3 py-2">Ninguna además de la sucursal base.</p>
                ) : (
                  <ul className="text-xs text-theme-secondary border border-theme-color rounded-lg px-3 py-2 space-y-1 list-disc list-inside">
                    {dmExtraVisibleRows.map((row) => (
                      <li key={row.branch.id}>{row.branch.name} ({row.branch.code})</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Telefono Empresa</label>
              <input {...register('companyPhone')} className="input-field" placeholder="Ext. 123" />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1">Telefono Auxiliar</label>
              <input {...register('auxiliaryPhone')} className="input-field" placeholder="Movil / Casa" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost text-sm">Cancelar</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {mutation.isPending && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
              {isEdit ? 'Guardar' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={!!inactiveUserToReactivate}
        title="Reactivar usuario"
        description={`El usuario "${inactiveUserToReactivate?.name}" (${inactiveUserToReactivate?.email}) está inactivo. ¿Deseas reactivarlo y continuar?`}
        confirmLabel="Reactivar"
        variant="warning"
        loading={reactivateMutation.isPending}
        onConfirm={() => inactiveUserToReactivate && reactivateMutation.mutate(inactiveUserToReactivate.id)}
        onCancel={() => setInactiveUserToReactivate(null)}
      />
      <ConfirmDialog
        open={confirmSkillsOpen}
        title="Confirmar cambios en skills"
        description={`Vas a cambiar las skills asignadas a este usuario. ¿Deseas confirmar los cambios?`}
        confirmLabel="Aplicar cambios"
        loading={mutation.isPending || assignSkillsMutation.isPending}
        onConfirm={handleConfirmSkills}
        onCancel={() => {
          setConfirmSkillsOpen(false);
          setPendingSubmitData(null);
        }}
      />
    </div>
  );
}

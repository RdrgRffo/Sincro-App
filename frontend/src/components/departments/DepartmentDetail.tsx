import { Pencil, UserCog } from 'lucide-react';
import type { Department } from '@/types';
import { displayRoleName } from '@/lib/roleLabels';

interface DepartmentDetailProps {
  department: Department;
  users: Array<{ id: string; name: string; email: string }>;
  usersLoading: boolean;
  onEdit: () => void;
  onManageMembers?: () => void;
  onManageManagers?: () => void;
  onDisable: () => void;
  onActivate: () => void;
  onHardDelete: () => void;
  isDisabling: boolean;
  isActivating: boolean;
  isDeleting: boolean;
}

export function DepartmentDetail({
  department,
  users,
  usersLoading,
  onEdit,
  onManageMembers,
  onManageManagers,
  onDisable,
  onActivate,
  onHardDelete,
  isDisabling,
  isActivating,
  isDeleting,
}: DepartmentDetailProps) {
  const managers = department.managers ?? [];
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Departamento seleccionado</p>
          <h3 className="text-base font-semibold text-theme-primary">{department.name}</h3>
          <p className="text-xs text-theme-muted">{department.code}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          department.isActive
            ? 'border border-theme-color bg-theme-surface text-theme-primary'
            : 'bg-amber-500/15 text-amber-600'
        }`}>{department.isActive ? 'Activo' : 'Inactivo'}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoBox label="Nombre" value={department.name} />
        <InfoBox label="Codigo" value={department.code} />
        <InfoBox label="Descripcion" value={department.description || 'Sin descripcion'} className="md:col-span-2" />
        <InfoBox label="Usuarios" value={String(department._count?.users ?? users.length)} />
        <InfoBox
          label="Sucursales"
          value={department.branches?.length
            ? department.branches.map((item) => item.branch.code).join(', ')
            : 'Sin sucursales'}
          className="md:col-span-2"
        />
      </div>

      {department.branches?.length ? (
        <div className="rounded-xl border border-theme-color bg-theme-surface-muted/30 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">Sucursales vinculadas</p>
          <div className="flex flex-wrap gap-2">
            {department.branches.map((item) => (
              <span key={item.branch.id} className="inline-flex items-center rounded-full border border-theme-color bg-theme-surface px-2.5 py-1 text-xs text-theme-primary">
                {item.branch.name} ({item.branch.code})
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {managers.length > 0 ? (
        <div className="rounded-xl border border-theme-color bg-theme-surface-muted/30 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">Gerentes de departamento (DM)</p>
          <div className="space-y-2">
            {managers.map((m) => (
              <div key={m.user.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-theme-primary truncate font-medium">{m.user.name}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-theme-color px-2 py-0.5 text-theme-muted shrink-0">
                    {displayRoleName(m.user.role?.name) ?? 'Gerente de departamento (DM)'}
                  </span>
                </div>
                <span className="text-theme-muted text-xs truncate">{m.user.email}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-theme-color bg-theme-surface-muted/30 p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">Usuarios asignados</p>
        {usersLoading ? (
          <p className="text-sm text-theme-muted">Cargando usuarios...</p>
        ) : users.length ? (
          <div className="space-y-1">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-theme-primary truncate">{user.name}</span>
                <span className="text-theme-muted text-xs truncate">{user.email}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted">Sin usuarios asignados</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-theme-color/80">
        {onManageMembers ? (
          <button type="button" onClick={onManageMembers} className="btn-ghost text-sm inline-flex items-center gap-1.5">
            Gestionar integrantes
          </button>
        ) : null}
        {onManageManagers ? (
          <button type="button" onClick={onManageManagers} className="btn-ghost text-sm inline-flex items-center gap-1.5">
            <UserCog className="h-4 w-4" />Gestionar managers
          </button>
        ) : null}
        {department.isActive ? (
          <button type="button" onClick={onDisable} disabled={isDisabling}
            className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60">Desactivar</button>
        ) : (
          <button type="button" onClick={onActivate} disabled={isActivating}
            className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60">Activar</button>
        )}
        <button type="button" onClick={onHardDelete} disabled={isDeleting}
          className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60">Eliminar definitivamente</button>
        <button type="button" onClick={onEdit} className="btn-ghost text-sm inline-flex items-center gap-1.5">
          <Pencil className="h-4 w-4" />Editar departamento
        </button>
      </div>
    </>
  );
}

function InfoBox({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-theme-color bg-theme-surface-muted/30 p-3 ${className ?? ''}`}>
      <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">{label}</p>
      <p className="text-sm text-theme-primary mt-1">{value}</p>
    </div>
  );
}

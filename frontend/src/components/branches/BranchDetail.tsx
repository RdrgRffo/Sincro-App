import { Pencil } from 'lucide-react';
import type { Branch } from '@/types';
import { displayRoleName } from '@/lib/roleLabels';

interface BranchDetailProps {
  branch: Branch;
  departments: Array<{ id: string; name: string; code: string; isActive: boolean }>;
  onSelectDepartment: (departmentId: string) => void;
  onEdit: () => void;
  onDisable: () => void;
  onActivate: () => void;
  onHardDelete: () => void;
  isDisabling: boolean;
  isActivating: boolean;
  isDeleting: boolean;
  onAssignManager?: () => void;
  onRemoveManager?: () => void;
  isAssigningManager?: boolean;
  isRemovingManager?: boolean;
}
export function BranchDetail({
  branch,
  departments,
  onSelectDepartment,
  onEdit, onDisable, onActivate, onHardDelete,
  isDisabling, isActivating, isDeleting,
  onAssignManager,
  onRemoveManager,
  isAssigningManager,
  isRemovingManager,
}: BranchDetailProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Sucursal seleccionada</p>
          <h3 className="text-base font-semibold text-theme-primary">{branch.name}</h3>
          <p className="text-xs text-theme-muted">{branch.code}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          branch.isActive
            ? 'border border-theme-color bg-theme-surface text-theme-primary'
            : 'bg-amber-500/15 text-amber-600'
        }`}>{branch.isActive ? 'Activa' : 'Inactiva'}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoBox label="Nombre" value={branch.name} />
        <InfoBox label="Código" value={branch.code} />
        <InfoBox label="Ciudad" value={branch.city || 'Sin ciudad'} />
        <InfoBox label="Región" value={branch.region || 'Sin región'} />
        <InfoBox label="Dirección" value={branch.address || 'Sin dirección'} className="md:col-span-2" />
        <InfoBox label="País" value={branch.countryCode} />
        <InfoBox label="Zona horaria" value={branch.timezone} />
      </div>

      <div className="rounded-xl border border-theme-color bg-theme-surface-muted/30 p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">Departamentos</p>
        {departments.length ? (
          <div className="flex flex-wrap gap-2">
            {departments.map((department) => (
              <button
                key={department.id}
                type="button"
                onClick={() => onSelectDepartment(department.id)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border border-theme-color bg-theme-surface hover:bg-theme-surface-hover"
              >
                {department.name} ({department.code}){department.isActive ? '' : ' · inactivo'}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted">Sin departamentos</p>
        )}
      </div>

      <div className="rounded-xl border border-theme-color bg-theme-surface-muted/30 p-3 space-y-3">
        <p className="text-[11px] uppercase tracking-wide text-theme-muted font-semibold">Gerente general (GM)</p>
        {branch.manager ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-theme-primary">{branch.manager.name}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-theme-color px-2 py-0.5 text-theme-muted">
                  {displayRoleName(branch.manager.role?.name) ?? 'Gerente general (GM)'}
                </span>
              </div>
              <p className="text-xs text-theme-muted">{branch.manager.email}</p>
            </div>
            {onRemoveManager ? (
              <button
                type="button"
                onClick={onRemoveManager}
                disabled={isRemovingManager}
                className="btn-ghost text-xs disabled:opacity-60"
              >
                Remover
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-theme-muted">Sin gerente general asignado</p>
            {onAssignManager ? (
              <button
                type="button"
                onClick={onAssignManager}
                disabled={isAssigningManager}
                className="btn-ghost text-xs disabled:opacity-60"
              >
                Asignar
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-theme-color/80">
        {branch.isActive ? (
          <button type="button" onClick={onDisable} disabled={isDisabling}
            className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60">Desactivar</button>
        ) : (
          <button type="button" onClick={onActivate} disabled={isActivating}
            className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60">Activar</button>
        )}
        <button type="button" onClick={onHardDelete} disabled={isDeleting}
          className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60">Eliminar definitivamente</button>
        <button type="button" onClick={onEdit} className="btn-ghost text-sm inline-flex items-center gap-1.5">
          <Pencil className="h-4 w-4" />Editar sucursal
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

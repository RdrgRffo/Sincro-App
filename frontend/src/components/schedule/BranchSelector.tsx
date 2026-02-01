import { CalendarDays } from 'lucide-react';
import type { Branch, Department } from '@/types';

interface BranchSelectorProps {
  branches: Branch[];
  activeBranchId: string;
  effectiveActiveBranchId: string;
  canSelectBranches: boolean;
  canViewAllBranches: boolean;
  onChange: (branchId: string) => void;
  departments?: Department[];
  selectedDeptId: string;
  onDepartmentChange: (departmentId: string) => void;
  /** Empleado: sin selector de departamento si solo hay uno (o ninguno) en su sede. */
  isEmployee?: boolean;
}

export function BranchSelector({
  branches,
  activeBranchId,
  effectiveActiveBranchId,
  canSelectBranches,
  canViewAllBranches,
  onChange,
  departments = [],
  selectedDeptId,
  onDepartmentChange,
  isEmployee = false,
}: BranchSelectorProps) {
  const extraOptions = canViewAllBranches ? 1 : 0;
  const shouldUseBranchDropdown = canSelectBranches && (branches.length + extraOptions > 3);
  const employeeDeptReadOnly = isEmployee && departments.length <= 1;
  const departmentSelector = employeeDeptReadOnly ? (
    <DepartmentEmployeeReadOnly departments={departments} />
  ) : (
    <DepartmentSelector
      departments={departments}
      selectedDeptId={selectedDeptId}
      onChange={onDepartmentChange}
    />
  );

  return (
    <div className="px-5 py-4 border-b border-theme-color">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-theme-muted uppercase tracking-wider mb-3">
        <CalendarDays className="h-3.5 w-3.5" />
        Sucursal y festivos
      </div>
      <div className="grid grid-cols-1 gap-3 text-xs font-medium">
        {canSelectBranches ? (
          shouldUseBranchDropdown ? (
            <div className="w-full space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-theme-muted mb-1.5">Selección de sucursal</label>
                <select value={activeBranchId} onChange={(e) => onChange(e.target.value)} className="input-field text-sm w-full">
                  {canViewAllBranches && <option value="">Todas las sucursales</option>}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{`${branch.name} (${branch.code})${branch.isActive ? '' : ' - Inactiva'}`}</option>
                  ))}
                </select>
              </div>
              {departmentSelector}
            </div>
          ) : (
            <>
              {canViewAllBranches && (
                <>
                  <BranchButton label="Todas las sucursales" isActive={!effectiveActiveBranchId} onClick={() => onChange('')} />
                  {!effectiveActiveBranchId && departmentSelector}
                </>
              )}
              {branches.map((branch) => (
                <div key={branch.id} className="space-y-2">
                  <BranchButton
                    label={branch.name}
                    isActive={effectiveActiveBranchId === branch.id}
                    onClick={() => onChange(branch.id)}
                    badge={!branch.isActive ? 'Inactiva' : undefined}
                  />
                  {effectiveActiveBranchId === branch.id && departmentSelector}
                </div>
              ))}
            </>
          )
        ) : effectiveActiveBranchId ? (
          <div className="space-y-2">
            <div className="rounded-lg border px-3 py-2 bg-theme-surface border-theme-color">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-1">Sucursal activa</p>
              <p className="text-xs text-theme-primary">
                {(() => {
                  const b = branches.find((branch) => branch.id === effectiveActiveBranchId);
                  if (!b) return 'Sucursal asignada';
                  return b.code ? `${b.name} (${b.code})` : b.name;
                })()}
              </p>
            </div>
            {departmentSelector}
          </div>
        ) : (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            No tienes una sucursal asignada. Contacta con un administrador.
          </p>
        )}
      </div>
    </div>
  );
}

function DepartmentEmployeeReadOnly({ departments }: { departments: Department[] }) {
  if (departments.length === 0) {
    return null;
  }
  const d = departments[0];
  return (
    <div
      className="rounded-lg border px-3 py-2 transition-colors"
      style={{
        backgroundColor: 'var(--theme-surface)',
        color: 'var(--theme-text-muted)',
        borderColor: 'var(--theme-border-color)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-1">Departamento</p>
      <p className="text-xs font-medium text-theme-primary">{d.code ? `${d.name} (${d.code})` : d.name}</p>
    </div>
  );
}

function DepartmentSelector({
  departments,
  selectedDeptId,
  onChange,
}: {
  departments: Department[];
  selectedDeptId: string;
  onChange: (departmentId: string) => void;
}) {
  return (
    <div className="rounded-lg border px-3 py-2 transition-colors"
      style={{
        backgroundColor: 'var(--theme-surface)',
        color: 'var(--theme-text-muted)',
        borderColor: 'var(--theme-border-color)',
      }}
    >
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-theme-muted mb-1.5">
        Filtrar por departamento
      </label>
      <select
        value={selectedDeptId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs font-medium border-0 rounded-md px-0 h-6 bg-transparent text-theme-primary focus:outline-none focus:ring-0"
      >
        <option value="">Todos los departamentos</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function BranchButton({ label, isActive, onClick, badge }: { label: string; isActive: boolean; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className="w-full text-left px-3 py-2 rounded-lg border transition-colors"
      style={isActive ? {
        backgroundColor: 'var(--theme-sidebar-active-bg)', color: 'var(--theme-sidebar-active-text)',
        borderColor: 'var(--theme-sidebar-active-bg)',
      } : {
        backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text-muted)', borderColor: 'var(--theme-border-color)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white">{badge}</span>}
      </div>
    </button>
  );
}

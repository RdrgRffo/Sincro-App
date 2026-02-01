import { format } from 'date-fns';
import { Calendar, MapPin, Users } from 'lucide-react';
import type { Branch, Department } from '@/types';
import type { PlanningFilters as PlanningFiltersValue } from '@/hooks/usePlanning';

type Props = {
  filters: PlanningFiltersValue;
  branches: Branch[];
  departments: Department[];
  onChange: (filters: PlanningFiltersValue) => void;
  roleName?: string;
  userDepartmentId?: string | null;
  userBranchId?: string | null;
  canViewOtherDepartments?: boolean;
};

export function PlanningFilters({
  filters,
  branches,
  departments,
  onChange,
  roleName = '',
  userDepartmentId = null,
  userBranchId = null,
  canViewOtherDepartments = false,
}: Props) {
  const isDM = roleName === 'department_manager';
  const isGM = roleName === 'general_manager';

  const updateDate = (field: 'from' | 'to', value: string) => {
    const date = new Date(`${value}T${field === 'from' ? '00:00:00' : '23:59:59'}`);
    onChange({ ...filters, [field]: date });
  };

  const handleBranchChange = (branchId: string) => {
    // When branch changes, reset department filter
    onChange({ ...filters, branchId: branchId || undefined, departmentId: undefined });
  };

  const handleDepartmentChange = (departmentId: string) => {
    onChange({ ...filters, departmentId: departmentId || undefined });
  };

  // DM without viewDepartment permission: department is locked to their own
  const isDepartmentLocked = isDM && !canViewOtherDepartments;
  const effectiveDepartmentId = isDepartmentLocked
    ? (userDepartmentId ?? filters.departmentId)
    : filters.departmentId;

  // GM: branch is locked to their own
  const isBranchLocked = isGM;
  const effectiveBranchId = isBranchLocked
    ? (userBranchId ?? filters.branchId)
    : filters.branchId;
  const selectedBranch = branches.find((branch) => branch.id === effectiveBranchId);
  const selectedDepartment = departments.find((department) => department.id === effectiveDepartmentId);
  const branchInactive = Boolean(selectedBranch && selectedBranch.isActive === false);
  const departmentInactive = Boolean(selectedDepartment && selectedDepartment.isActive === false);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
        <Calendar className="w-4 h-4 text-slate-400" />
        <input
          type="date"
          className="bg-transparent text-sm border-none focus:ring-0 p-0 font-semibold text-slate-700"
          value={format(filters.from, 'yyyy-MM-dd')}
          onChange={(event) => updateDate('from', event.target.value)}
        />
        <span className="text-slate-300 mx-1">→</span>
        <input
          type="date"
          className="bg-transparent text-sm border-none focus:ring-0 p-0 font-semibold text-slate-700"
          value={format(filters.to, 'yyyy-MM-dd')}
          onChange={(event) => updateDate('to', event.target.value)}
        />
      </div>

      <div className="flex min-w-60 items-center gap-2 px-3">
        <MapPin className="w-4 h-4 text-slate-400" />
        {isBranchLocked ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-500">
              {selectedBranch?.name ?? 'Mi sede'}
            </span>
            {branchInactive && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                Inactiva
              </span>
            )}
          </div>
        ) : (
          <>
            <select
              className="min-w-0 flex-1 bg-transparent p-0 text-sm font-medium text-slate-700 cursor-pointer border-none focus:ring-0"
              value={effectiveBranchId ?? ''}
              onChange={(event) => handleBranchChange(event.target.value)}
            >
              <option value="">Todas las sedes visibles</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {branchInactive && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                Inactiva
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex min-w-60 items-center gap-2 px-3">
        <Users className="w-4 h-4 text-slate-400" />
        {isDepartmentLocked ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-500">
              {selectedDepartment?.name ?? 'Mi departamento'}
            </span>
            {departmentInactive && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                Inactivo
              </span>
            )}
          </div>
        ) : (
          <>
            <select
              className="min-w-0 flex-1 bg-transparent p-0 text-sm font-medium text-slate-700 cursor-pointer border-none focus:ring-0"
              value={effectiveDepartmentId ?? ''}
              onChange={(event) => handleDepartmentChange(event.target.value)}
            >
              <option value="">Todos los departamentos</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {departmentInactive && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                Inactivo
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

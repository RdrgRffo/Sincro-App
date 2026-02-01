import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import type { Branch, BranchHoliday, Department, ScheduleType, User as UserType } from '@/types';
import { BranchSelector } from './BranchSelector';
import { HolidayLegend } from './HolidayLegend';
import { TypeLegend } from './TypeLegend';
import api from '@/config/api';

interface ScheduleSidebarProps {
  branches: Branch[];
  activeBranchId: string;
  effectiveActiveBranchId: string;
  canSelectBranches: boolean;
  canViewAllBranches: boolean;
  onBranchChange: (branchId: string) => void;
  departments?: Department[];
  selectedDeptId: string;
  onDepartmentChange: (departmentId: string) => void;
  hiddenTypes: Set<string>;
  onToggleType: (type: string) => void;
  typeCounts: Record<string, number>;
  holidayTypeCounts: Partial<Record<BranchHoliday['type'], number>>;
  scheduleTypes: ScheduleType[];
  isEmployee: boolean;
  filterUserId: string;
  onFilterUserChange: (userId: string) => void;
}

export function ScheduleSidebar({
  branches, activeBranchId, effectiveActiveBranchId, canSelectBranches, canViewAllBranches, onBranchChange,
  departments, selectedDeptId, onDepartmentChange, hiddenTypes, onToggleType, typeCounts, holidayTypeCounts,
  scheduleTypes, isEmployee, filterUserId, onFilterUserChange,
}: ScheduleSidebarProps) {
  const [userSearch, setUserSearch] = useState('');

  const { data: usersData } = useQuery<{ data: UserType[] }>({
    queryKey: ['users', 'schedule-filter', effectiveActiveBranchId || 'all', selectedDeptId || 'all'],
    queryFn: () => {
      const params: Record<string, string> = { limit: '500', status: 'active' };
      if (effectiveActiveBranchId) params.branchId = effectiveActiveBranchId;
      if (selectedDeptId) params.departmentId = selectedDeptId;
      return api.get('/users', { params }).then((r) => r.data);
    },
    enabled: !isEmployee,
  });

  const filteredUsers = (usersData?.data ?? []).filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <aside className="border-r border-theme-color h-full">



      <BranchSelector
        branches={branches}
        activeBranchId={activeBranchId}
        effectiveActiveBranchId={effectiveActiveBranchId}
        canSelectBranches={canSelectBranches}
        canViewAllBranches={canViewAllBranches}
        onChange={onBranchChange}
        departments={departments}
        selectedDeptId={selectedDeptId}
        onDepartmentChange={onDepartmentChange}
        isEmployee={isEmployee}
      />

      {/* Filtro de usuario */}
      <div className="px-5 py-4 border-b border-theme-color">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-theme-muted uppercase tracking-wider mb-3">
          <Filter className="h-3.5 w-3.5" />
          Filtro de turnos
        </div>

        {isEmployee ? (
          /* Item 17: Toggle "Mis turnos" para employee */
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterUserId !== ''}
              onChange={(e) => onFilterUserChange(e.target.checked ? 'me' : '')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-theme-primary">Mostrar solo mis turnos</span>
          </label>
        ) : (
          /* Item 18: Selector de usuario para admin/GM/DM */
          <div className="space-y-3">
            <select
              value={filterUserId}
              onChange={(e) => onFilterUserChange(e.target.value)}
              className="input-field text-sm w-full"
            >
              <option value="">Todos los usuarios</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {filteredUsers.length > 10 && (
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuario..."
                className="input-field text-xs w-full"
              />
            )}
          </div>
        )}
      </div>

      <TypeLegend scheduleTypes={scheduleTypes} hidden={hiddenTypes} onToggle={onToggleType} counts={typeCounts} />

      <HolidayLegend holidayTypeCounts={holidayTypeCounts} />
    </aside>
  );
}

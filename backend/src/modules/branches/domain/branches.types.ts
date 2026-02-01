import { HolidayScope, HolidayType } from '../branches.constants';

export type BranchHolidayType = HolidayType;

export type BranchHolidayScope = HolidayScope;

export type BranchActor = {
  id: string;
  ipAddress?: string;
};

export type BranchInput = {
  name: string;
  code: string;
  address?: string;
  city?: string;
  region?: string;
  countryCode?: string;
  timezone?: string;
  isActive?: boolean;
};

export type BranchHolidayInput = {
  date: Date;
  originalDate?: Date | null;
  name: string;
  type: BranchHolidayType;
  scope?: BranchHolidayScope;
  isPartial?: boolean;
};

/** Actor opcional para acotar el listado de sucursales (empleado / responsable). */
export type ListBranchesActor = {
  roleName: string;
  branchId: string | null | undefined;
  visibleBranchIds?: string[];
};

export type ListBranchesParams = {
  includeInactive: boolean;
  actor?: ListBranchesActor;
};

export type ListBranchHolidaysParams = {
  year?: number;
  from?: string;
  to?: string;
  includeInactive: boolean;
  groupShared?: boolean;
};

export type BulkHolidayActionInput = {
  holidayIds: string[];
  name?: string;
  date?: Date;
  type?: BranchHolidayType;
  scope?: BranchHolidayScope;
  isPartial?: boolean;
};

export type GroupedBranchHoliday = {
  id: string;
  branchId: 'all';
  date: Date;
  originalDate?: Date | null;
  name: string;
  type: BranchHolidayType;
  scope: BranchHolidayScope;
  isPartial: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  branch: null;
  holidayIds: string[];
  branches: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  sharedCount: number;
};

import type { PermissionName, RoleName } from '../roles/roles.constants';

export type PlanningActor = {
  id: string;
  roleName: RoleName | string;
  branchId: string | null;
  departmentId: string | null;
  permissions: PermissionName[] | string[];
  visibleBranchIds?: string[];
};

export type PlanningRangeFilters = {
  from: Date;
  to: Date;
  branchId?: string;
  departmentId?: string;
};

export type ScopedPlanningRangeFilters = PlanningRangeFilters & {
  branchIds?: string[];
  page?: number;
  pageSize?: number;
};

export type CoverageRiskSeverity = 'high' | 'medium' | 'low';

export type CoverageRiskItem = {
  severity: CoverageRiskSeverity;
  reasons: string[];
  schedule: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
    branch: { id: string; name: string } | null;
  };
  absenceConflicts?: Array<{
    userId: string;
    absenceId: string;
    startDate: string;
    endDate: string;
  }>;
};

export type AvailabilityStatus = 'available' | 'busy' | 'absence';

export type PlanningSkill = {
  id: string;
  name: string;
  category: string | null;
  color: string;
};

export type AvailabilityItem = {
  userId: string;
  userName: string;
  email?: string;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  skills?: PlanningSkill[];
  status?: AvailabilityStatus;
  schedulesCount?: number;
  absencesCount?: number;
  days: Array<{
    date: string;
    status: AvailabilityStatus;
  }>;
};

export type AvailabilityMatrix = {
  days: string[];
  rows: Array<{
    id: string;
    name: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
    skills: PlanningSkill[];
    days: Array<{
      date: string;
      status: AvailabilityStatus;
      schedules: Array<{ id: string; title: string }>;
      absenceIds?: string[];
    }>;
  }>;
};

export type SubstituteSuggestion = {
  id: string;
  name: string;
  email: string;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  skills: PlanningSkill[];
  matchedSkills: PlanningSkill[];
  score: number;
  equity: {
    hours: number;
    weekends: number;
    urgent: number;
    overtimeEstimate: number;
  };
  reasons: string[];
};

export type EquityItem = {
  id: string;
  name: string;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  totalHours: number;
  overtimeEstimate: number;
  weekendShifts: number;
  urgentShifts: number;
  approvedAbsences: number;
  rejectedAbsences: number;
};

export type TimelineItem = {
  type: 'holiday' | 'absence' | 'schedule';
  at: string;
  title: string;
  severity: 'info' | 'normal' | 'medium' | 'high';
  branch?: { id: string; name: string } | null;
  branchId?: string | null;
  assignees?: Array<{ id: string; name: string }>;
};

export type CrisisModeSummary = {
  highRisks: CoverageRiskItem[];
  mediumRisks: CoverageRiskItem[];
  overloaded: EquityItem[];
  today: TimelineItem[];
};

export type TemplatePreviewCandidate = {
  id: string;
  name: string;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  matchedSkills: PlanningSkill[];
  score: number;
};

export type TemplatePreviewDay = {
  date: string;
  minCoverage: number;
  recommended: TemplatePreviewCandidate[];
  backups: TemplatePreviewCandidate[];
  status: 'covered' | 'partial' | 'uncovered';
};

export type AbsenceImpact = {
  employee: {
    id: string;
    name: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  };
  overlappingAbsences: Array<{
    id: string;
    status: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    employee: { id: string; name: string };
  }>;
  assignedSchedules: Array<{
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
  }>;
  holidays: Array<{
    id: string;
    name: string;
    date: string;
  }>;
  likelihood: 'high' | 'medium' | 'low';
  summary: string;
};

export type PlanningComment = {
  id: string;
  entityType: string;
  entityId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
};

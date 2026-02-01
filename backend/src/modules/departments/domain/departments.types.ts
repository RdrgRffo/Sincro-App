export type DepartmentActor = {
  id: string;
  ipAddress?: string;
};

export type DepartmentInput = {
  name: string;
  code: string;
  description?: string;
  branchIds: string[];
  isActive?: boolean;
};

/** Contexto mínimo del actor para acotar listados (p. ej. empleado solo en su sede). */
export type ListDepartmentsActor = {
  roleName: string;
  branchId: string | null | undefined;
  visibleBranchIds?: string[];
};

export type ListDepartmentsParams = {
  branchId?: string;
  includeInactive: boolean;
  actor?: ListDepartmentsActor;
};

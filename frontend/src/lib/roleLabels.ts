const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  general_manager: 'Gerente general (GM)',
  department_manager: 'Gerente de departamento (DM)',
  employee: 'Empleado',
};

export function displayRoleName(roleName: string | undefined | null): string | null {
  if (!roleName) return null;
  return ROLE_LABELS[roleName] ?? roleName;
}

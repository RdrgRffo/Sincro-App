export function normalizeDepartmentCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeDepartmentName(value: string): string {
  return value.trim();
}

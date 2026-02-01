import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

/** Nombres de permiso efectivos (alineado con `GET /api/auth/me`). */
export function getUserPermissionNames(user: User | null | undefined): string[] {
  if (!user) return [];
  if (user.permissions?.length) return user.permissions;
  return user.role?.permissions?.map((p) => p.name) ?? [];
}

export function userHasPermission(user: User | null | undefined, permission: string): boolean {
  return getUserPermissionNames(user).includes(permission);
}

export function usePermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => userHasPermission(user, permission), [user, permission]);
}

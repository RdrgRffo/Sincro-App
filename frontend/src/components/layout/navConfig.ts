import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  ClipboardList,
  CalendarClock,
  Users,
  Building2,
  Layers,
  Webhook,
  Bell,
  Clock,
} from 'lucide-react';

/** Roles reconocidos en la SPA (alineado con `User.role.name`). */
export type AppRole = 'admin' | 'general_manager' | 'department_manager' | 'employee';

export type MainNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  /** Si se define, solo estos roles ven el ítem (omitir = todos los autenticados). */
  roles?: AppRole[];
};

/** Roles que pueden ver Planificación (ruta + menú alineados con `App.tsx` / `RoleGuard`). */
export const PLANNING_NAV_ROLES: AppRole[] = ['admin', 'general_manager', 'department_manager'];

/** Navegación principal con planificación fuera de `/admin`. */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/schedule', icon: Calendar, label: 'Turnos' },
  { to: '/planning', icon: ClipboardList, label: 'Planificación', roles: PLANNING_NAV_ROLES },
  { to: '/ausencias', icon: CalendarDays, label: 'Ausencias' },
];

export function mainNavItemsForRole(roleName: string | undefined): MainNavItem[] {
  const r = roleName as AppRole | undefined;
  return MAIN_NAV_ITEMS.filter((item) => {
    if (!item.roles?.length) return true;
    return Boolean(r && item.roles.includes(r));
  });
}

export type AdminNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Debe coincidir con los `RoleGuard` de `App.tsx` para esa ruta. */
  roles: AppRole[];
};

export type AdminNavSection = { sectionLabel: string; items: AdminNavItem[] };

/**
 * Secciones de administración filtradas por rol.
 * Webhooks + notificaciones salientes (Teams): rutas para admin y gerente general;
 * listado GET de webhooks acotado por sede para quien no sea admin / no tenga `webhooks:manage`.
 * Envíos manuales: API con `notifications:send` (GM) o `webhooks:manage` (admin); CRUD de webhooks solo `webhooks:manage`.
 */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    sectionLabel: 'Equipo y catálogos',
    items: [
      { to: '/admin/users', icon: Users, label: 'Usuarios', roles: ['admin', 'general_manager', 'department_manager'] },
      { to: '/admin/skills', icon: CalendarClock, label: 'Skills', roles: ['admin', 'general_manager', 'department_manager'] },
      { to: '/admin/schedule-types', icon: CalendarDays, label: 'Tipos de Turno', roles: ['admin', 'general_manager', 'department_manager'] },
      { to: '/admin/holidays', icon: CalendarDays, label: 'Festivos', roles: ['admin', 'general_manager'] },
    ],
  },
  {
    sectionLabel: 'Organización',
    items: [
      { to: '/admin/branches', icon: Building2, label: 'Sucursales', roles: ['admin'] },
      { to: '/admin/departments', icon: Layers, label: 'Departamentos', roles: ['admin'] },
    ],
  },
  {
    sectionLabel: 'Integraciones y avisos',
    items: [
      { to: '/admin/webhooks', icon: Webhook, label: 'Webhooks', roles: ['admin', 'general_manager'] },
      { to: '/admin/notifications', icon: Bell, label: 'Notificaciones', roles: ['admin', 'general_manager'] },
    ],
  },
  {
    sectionLabel: 'Sistema',
    items: [
      { to: '/admin/shift-presets', icon: Clock, label: 'Turnos Predefinidos', roles: ['admin'] },
      { to: '/admin/audit', icon: ClipboardList, label: 'Auditoría', roles: ['admin'] },
    ],
  },
];

export function adminNavSectionsForRole(roleName: string | undefined): AdminNavSection[] {
  const r = roleName as AppRole | undefined;
  if (!r) return [];
  return ADMIN_NAV_SECTIONS.map((sec) => ({
    sectionLabel: sec.sectionLabel,
    items: sec.items.filter((item) => item.roles.includes(r)),
  })).filter((sec) => sec.items.length > 0);
}

/** Lista plana para menús móviles compactos (mantiene orden de sección). */
export function adminNavFlatForRole(roleName: string | undefined): AdminNavItem[] {
  return adminNavSectionsForRole(roleName).flatMap((s) => s.items);
}

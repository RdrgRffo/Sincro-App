import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ForbiddenPage } from '@/components/common/ForbiddenPage';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #334155', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

const ROUTE_LABELS: Record<string, string> = {
  '/planning': 'planificación operativa',
  '/admin/users': 'gestión de usuarios',
  '/admin/skills': 'gestión de skills',
  '/admin/schedule-types': 'gestión de tipos de turno',
  '/admin/holidays': 'gestión de festivos',
  '/admin/notifications': 'gestión de notificaciones (webhooks)',
  '/admin/branches': 'gestión de sucursales',
  '/admin/departments': 'gestión de departamentos',
  '/admin/webhooks': 'gestión de webhooks',
  '/admin/audit': 'registro de auditoría',
  '/admin/shift-presets': 'gestión de plantillas de turno',
};

export function RoleGuard({ roles }: { roles: string[] }) {
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || !roles.includes(user.role?.name)) {
    const sectionLabel = ROUTE_LABELS[location.pathname] ?? 'esta sección';
    const requiredRoles = roles
      .map((r) => ({ admin: 'administrador', general_manager: 'gerente general', department_manager: 'gerente de departamento' })[r] ?? r)
      .join(', ');
    return (
      <ForbiddenPage
        message={`Tu rol (${user?.role?.name ?? 'sin rol'}) no tiene permisos para acceder a ${sectionLabel}. Se requiere uno de los siguientes roles: ${requiredRoles}.`}
      />
    );
  }
  return <Outlet />;
}

import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS } from '@/types';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import api from '@/config/api';
import toast from 'react-hot-toast';
import { SincroLogo } from '@/components/common/SincroLogo';
import { mainNavItemsForRole, adminNavSectionsForRole } from '@/components/layout/navConfig';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken: useAuthStore.getState().refreshToken });
    } catch {
      /* ignore */
    }
    logout();
    navigate('/login');
    toast.success('Sesión cerrada');
  };

  const roleName = user?.role?.name;
  const isAdminOrManager =
    roleName === 'admin' || roleName === 'general_manager' || roleName === 'department_manager';

  const adminSections = adminNavSectionsForRole(roleName);
  const mainNavItems = mainNavItemsForRole(roleName);

  return (
    <aside
      className="flex flex-col h-screen w-64 z-30"
      style={{
        backgroundColor: 'var(--theme-sidebar-bg)',
        color: 'var(--theme-sidebar-text)',
      }}
    >
      {/* Logo */}
      <div className="border-b border-white/10 flex items-center justify-center px-5 py-5">
        <SincroLogo size="xl" className="w-full max-w-52.5" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto schedule-sidebar-scroll">
        {mainNavItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all',
                isActive ? 'text-white' : 'text-theme-sidebar hover:text-white',
              )
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--theme-sidebar-active-bg)' : 'transparent',
              color: isActive ? 'var(--theme-sidebar-active-text)' : undefined,
            })}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {isAdminOrManager && adminSections.length > 0 && (
          <>
            <p className="text-xs font-semibold text-theme-sidebar uppercase tracking-wider px-3 pt-5 pb-2">
              Administración
            </p>
            {adminSections.map((section, sectionIndex) => (
              <div key={section.sectionLabel} className={cn(sectionIndex > 0 && 'pt-3')}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-sidebar/80 px-3 pb-1.5">
                  {section.sectionLabel}
                </p>
                {section.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all',
                        isActive ? 'text-white' : 'text-theme-sidebar hover:text-white',
                      )
                    }
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? 'var(--theme-sidebar-active-bg)' : 'transparent',
                      color: isActive ? 'var(--theme-sidebar-active-text)' : undefined,
                    })}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-4 space-y-1.5">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
              isActive ? 'bg-white/10' : 'hover:bg-white/5',
            )
          }
        >
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: getAvatarColor(user?.name || '') }}
          >
            {getInitials(user?.name || 'U')}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-theme-sidebar truncate">
              {user?.department?.name || (user?.role?.name ? ROLE_LABELS[user.role.name] : '')}
            </p>
          </div>
          <User className="h-3.5 w-3.5 text-theme-sidebar ml-auto shrink-0" />
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-theme-sidebar hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

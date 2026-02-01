import { NavLink } from 'react-router-dom';
import { User, MoreHorizontal } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { mainNavItemsForRole, adminNavFlatForRole } from '@/components/layout/navConfig';

export function MobileNav() {
  const user = useAuthStore((s) => s.user);
  const roleName = user?.role?.name;
  const isAdminOrManager =
    roleName === 'admin' || roleName === 'general_manager' || roleName === 'department_manager';

  const [menuOpen, setMenuOpen] = useState(false);
  const adminExtras = adminNavFlatForRole(roleName);
  const mainNavItems = mainNavItemsForRole(roleName);

  return (
    <>
      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-20 bg-black/20" onClick={() => setMenuOpen(false)} />
          <div
            id="mobile-nav-extras"
            className="md:hidden fixed bottom-16 left-0 right-0 z-30 mx-3 mb-1 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-gray-200 shadow-xl"
            style={{ backgroundColor: 'var(--theme-surface)' }}
            role="region"
            aria-label="Accesos de administración y cuenta"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted px-4 pt-3 pb-1 sticky top-0 bg-[var(--theme-surface)]">
              {isAdminOrManager && adminExtras.length > 0 ? 'Administración' : 'Cuenta'}
            </p>

            {isAdminOrManager &&
              adminExtras.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 text-sm font-medium border-b border-gray-100 transition-colors',
                      isActive ? 'text-gray-900 bg-gray-100' : 'text-theme-primary',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
          </div>
        </>
      )}

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 border-t border-gray-200 z-30 safe-area-bottom"
        style={{ backgroundColor: 'var(--theme-surface)' }}
      >
        <div className="flex items-center justify-around h-14">
          {mainNavItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors min-w-0',
                  isActive ? 'text-gray-900' : 'text-gray-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-gray-900')} />
                  <span className="truncate max-w-[4.25rem] text-center leading-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors min-w-0',
                isActive ? 'text-gray-900' : 'text-gray-400',
              )
            }
          >
            {({ isActive }) => (
              <>
                <User className={cn('h-5 w-5 shrink-0', isActive && 'text-gray-900')} />
                <span className="truncate max-w-[4.25rem]">Perfil</span>
              </>
            )}
          </NavLink>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors min-w-0',
              menuOpen ? 'text-gray-900' : 'text-gray-400',
            )}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-extras"
            aria-label={menuOpen ? 'Cerrar menú de administración' : 'Abrir menú de administración'}
          >
            <MoreHorizontal className={cn('h-5 w-5 shrink-0', menuOpen && 'text-gray-900')} aria-hidden />
            <span className="truncate max-w-[4.25rem]">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}

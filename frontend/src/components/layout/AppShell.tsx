import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { useAuthStore } from '@/store/authStore';
import { ForceChangePassword } from '../auth/ForceChangePassword';
import { resolvePasswordChangeState } from '@/lib/passwordPolicy';
import { AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const passwordChangeState = resolvePasswordChangeState(user);
  const shouldForcePasswordChange = passwordChangeState === 'required';
  const shouldShowWarningBanner = passwordChangeState === 'warning';

  if (shouldForcePasswordChange) {
    return <ForceChangePassword />;
  }

  let warningText = '';
  if (shouldShowWarningBanner && user?.passwordChangeDeadlineAt) {
    const deadline = new Date(user.passwordChangeDeadlineAt);
    if (!Number.isNaN(deadline.getTime())) {
      warningText = `Debes actualizar tu contraseña antes de ${formatDateTime(user.passwordChangeDeadlineAt)} para evitar bloqueo automático.`;
    }
  }

  if (!warningText && shouldShowWarningBanner) {
    warningText = 'Actualiza tu contraseña dentro del plazo para evitar bloqueo automático.';
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        {shouldShowWarningBanner && (
          <div className="px-6 md:px-8 pt-3">
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs md:text-sm font-medium">{warningText}</p>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 md:p-9 pb-24 md:pb-9">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}

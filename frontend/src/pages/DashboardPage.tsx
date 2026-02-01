import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, AlertTriangle, ExternalLink, UserCircle } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { UserProfileModal } from '@/components/common/UserProfileModal';
import { DashboardSkeleton } from '@/components/common/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import type { User, WeekScheduleAssignee } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TeamWeeklySummaryCard } from '@/components/schedule/TeamWeeklySummaryCard';
import { MyWeeklySummaryCard } from '@/components/schedule/MyWeeklySummaryCard';
import { WeekSchedulesWidget } from '@/components/schedule/WeekSchedulesWidget';
import { AlertsModal } from '@/components/schedule/AlertsModal';
import { RecentActivityWidget } from '@/components/audit/RecentActivityWidget';
import { useDashboardData } from '@/hooks/useDashboardData';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | WeekScheduleAssignee | null>(null);
  const [profileModalTab, setProfileModalTab] = useState<'general' | 'schedules' | 'security' | 'skills'>('general');
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);

  const { now, loadingSchedules, weekSchedules, loadingUsers, usersData, alerts, totalAlerts, mySchedules, lastMinuteCount } = useDashboardData(user);

  const statCornerLinkClass = cn(
    'absolute bottom-4 right-4 p-1.5 rounded-lg transition-all duration-200 z-20 cursor-pointer transform group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-md',
    'bg-white/90 hover:bg-white text-green-600 shadow-sm border border-green-200',
  );

  const navigateToScheduleWeek = () => {
    navigate('/schedule', { state: { initialView: 'timeGridWeek', initialDate: now.toISOString() } });
  };

  const openMyProfileSchedules = () => {
    if (!user) return;
    setSelectedProfileUser(user);
    setProfileModalTab('schedules');
    setProfileModalOpen(true);
  };

  const navigateToActiveUsers = () => {
    navigate('/admin/users', { state: { status: 'active' } });
  };

  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    onActivate: () => void,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  };

  const handleOpenProfile = (assignee: WeekScheduleAssignee) => {
    setSelectedProfileUser(assignee);
    setProfileModalOpen(true);
  };

  const isAdmin = user?.role?.name === 'admin';

  if (loadingSchedules && !weekSchedules) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header */}
      <div className="min-h-14">
        <h1 className="text-2xl font-bold text-theme-primary">
          Bienvenido, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-theme-muted text-sm mt-1.5 capitalize">
          {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div
          className="relative group flex flex-col h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-2xl"
          role="button"
          tabIndex={0}
          aria-label="Ver turnos de esta semana en calendario"
          onClick={navigateToScheduleWeek}
          onKeyDown={(event) => handleCardKeyDown(event, navigateToScheduleWeek)}
        >
          <StatCard
            title="Turnos de esta semana"
            value={loadingSchedules ? '—' : (weekSchedules?.length || 0)}
            icon={Calendar}
            color="navy"
            className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200"
          />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/schedule', { state: { initialView: 'timeGridWeek', initialDate: now.toISOString() } }); }}
            className={statCornerLinkClass}
            title="Ver en calendario (Vista semanal)"
            aria-label="Ver en calendario (Vista semanal)"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div
          className="relative group flex flex-col h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-2xl"
          role="button"
          tabIndex={0}
          aria-label="Ver mis turnos en el perfil"
          onClick={openMyProfileSchedules}
          onKeyDown={(event) => handleCardKeyDown(event, openMyProfileSchedules)}
        >
          <StatCard
            title="Mis turnos"
            value={loadingSchedules ? '—' : mySchedules.length}
            color="navy"
            className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openMyProfileSchedules();
            }}
            className={statCornerLinkClass}
            title="Ver mis turnos en el perfil"
            aria-label="Ver mis turnos en el perfil"
          >
            <UserCircle className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {(user?.role?.name === 'admin' || user?.role?.name === 'general_manager' || user?.role?.name === 'department_manager') && (
          <div
          className="relative group flex flex-col h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-2xl"
            role="button"
            tabIndex={0}
            aria-label="Ver gestión de usuarios activos"
            onClick={navigateToActiveUsers}
            onKeyDown={(event) => handleCardKeyDown(event, navigateToActiveUsers)}
          >
            <StatCard
              title="Usuarios activos"
              value={loadingUsers ? '—' : (usersData || 0)}
              icon={Users}
              color="navy"
              className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200"
            />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/admin/users', { state: { status: 'active' } }); }}
              className={statCornerLinkClass}
              title="Ver gestión de usuarios"
              aria-label="Ver gestión de usuarios"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {(user?.role?.name === 'admin' || user?.role?.name === 'general_manager' || user?.role?.name === 'department_manager') && (
          <div
          className="relative group flex flex-col h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-2xl"
            role="button"
            tabIndex={0}
            aria-label="Ver alertas de turnos"
            onClick={() => setAlertsModalOpen(true)}
            onKeyDown={(event) => handleCardKeyDown(event, () => setAlertsModalOpen(true))}
          >
            <StatCard
              title="Alertas"
              value={loadingSchedules ? '—' : totalAlerts + lastMinuteCount}
              icon={AlertTriangle}
              color={totalAlerts > 0 || lastMinuteCount > 0 ? 'purple' : 'navy'}
              className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-gray-200"
            />
          </div>
        )}
      </div>

      {/* Main grid: Week schedules + Activity log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <WeekSchedulesWidget onOpenProfile={handleOpenProfile} />
        </div>

        {isAdmin && (
          <div className="lg:col-span-1">
            <RecentActivityWidget />
          </div>
        )}
      </div>


      {/* My weekly summary (all users) */}
      <MyWeeklySummaryCard />

      {/* Team weekly summary (admin/manager view) */}
      {(user?.role?.name === 'admin' || user?.role?.name === 'general_manager' || user?.role?.name === 'department_manager') && (
        <TeamWeeklySummaryCard />
      )}

      <AlertsModal
        open={alertsModalOpen}
        onClose={() => setAlertsModalOpen(false)}
        alerts={alerts || []}
        lastMinuteCount={lastMinuteCount}
      />

      <UserProfileModal
        open={profileModalOpen}
        user={selectedProfileUser}
        onClose={() => setProfileModalOpen(false)}
        initialTab={profileModalTab}
        setTab={setProfileModalTab}
      />
    </div>
  );
}

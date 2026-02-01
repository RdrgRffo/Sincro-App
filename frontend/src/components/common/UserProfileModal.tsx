import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Mail, Phone, CalendarDays, ShieldAlert, Clock3, Activity, Zap } from 'lucide-react';
import api from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import { type Schedule, type User, ROLE_LABELS, STATUS_LABELS } from '@/types';
import { cn, getInitials, getAvatarColor, formatDate, formatDateTime, formatRelative } from '@/lib/utils';
import { resolvePasswordChangeState } from '@/lib/passwordPolicy';

interface UserProfileModalProps {
    open: boolean;
    onClose: () => void;
    user:
    | User
    | {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
        department?: { name: string } | null;
        companyPhone?: string;
        auxiliaryPhone?: string;
        role?: string;
        createdAt?: string;
    }
    | null;
    initialTab?: 'general' | 'schedules' | 'security' | 'skills';
    setTab?: (tab: 'general' | 'schedules' | 'security' | 'skills') => void;
}


type ProfileTab = 'general' | 'schedules' | 'security' | 'skills';

export function UserProfileModal({ open, onClose, user, initialTab, setTab }: UserProfileModalProps) {
    // Si initialTab es nullish, default a 'general' solo al abrir
    const [internalTab, setInternalTab] = useState<ProfileTab>(initialTab ?? 'general');
    // Sincroniza initialTab solo cuando el modal se abre
    const prevOpenRef = useRef(open);
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setInternalTab(initialTab ?? 'general');
        }
        prevOpenRef.current = open;
    }, [open, initialTab]);
    const activeTab = setTab ? (initialTab ?? 'general') : internalTab;
    const handleSetTab = useCallback((tab: ProfileTab) => {
        if (setTab) setTab(tab);
        else setInternalTab(tab);
    }, [setTab]);
    const currentUser = useAuthStore((s) => s.user);
    const canLoadDetailedUser = currentUser?.role?.name === 'admin' || currentUser?.role?.name === 'general_manager' || currentUser?.role?.name === 'department_manager' || currentUser?.role?.name === 'employee';
    const canLoadPrivateData = currentUser?.role?.name === 'admin' || currentUser?.role?.name === 'general_manager' || currentUser?.role?.name === 'department_manager';
        const canLoadSchedules = Boolean(currentUser);
    const canViewSecurityTab = canLoadPrivateData;

    // If user loses permission to view security tab, fall back to general
    const prevCanViewSecurityRef = useRef(canViewSecurityTab);
    useEffect(() => {
        if (!canViewSecurityTab && prevCanViewSecurityRef.current && activeTab === 'security') {
            handleSetTab('general');
        }
        prevCanViewSecurityRef.current = canViewSecurityTab;
    }, [activeTab, canViewSecurityTab, handleSetTab]);

    const { data: detailedUser, isLoading: loadingUserDetail } = useQuery({
        queryKey: ['user-profile-modal-detail', user?.id],
        queryFn: () => api.get<{ data: User }>(`/users/${user!.id}`).then((r) => r.data.data),
        enabled: open && canLoadDetailedUser && Boolean(user?.id),
        retry: false,
    });

    const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
        queryKey: ['user-profile-modal-schedules', user?.id],
        queryFn: () => api.get<{ data: Schedule[] }>(`/users/${user!.id}/schedules`).then((r) => r.data.data),
        enabled: open && canLoadSchedules && Boolean(user?.id),
        retry: false,
    });

    const metrics = useMemo(() => {
        if (!schedules.length) {
            return {
                nextShift: null as Schedule | null,
                lastShift: null as Schedule | null,
                weekCount: 0,
                monthCount: 0,
                hours7d: 0,
                hours30d: 0,
            };
        }

        const now = new Date();
        const nowTime = now.getTime();
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const horizon7d = new Date(now);
        horizon7d.setDate(horizon7d.getDate() + 7);
        const horizon30d = new Date(now);
        horizon30d.setDate(horizon30d.getDate() + 30);

        const withDates = schedules
            .map((s) => ({
                schedule: s,
                start: new Date(s.startDatetime),
                end: new Date(s.endDatetime),
            }))
            .filter(({ start, end }) => !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));

        const nextShift = withDates
            .filter(({ start }) => start.getTime() >= nowTime)
            .sort((a, b) => a.start.getTime() - b.start.getTime())[0]?.schedule ?? null;

        const lastShift = withDates
            .filter(({ end }) => end.getTime() <= nowTime)
            .sort((a, b) => b.end.getTime() - a.end.getTime())[0]?.schedule ?? null;

        const weekCount = withDates.filter(({ start }) => start >= weekStart && start <= weekEnd).length;
        const monthCount = withDates.filter(({ start }) => start >= monthStart && start <= monthEnd).length;

        const getScheduleHours = (schedule: Schedule) => {
            if (typeof schedule.hoursPerDay === 'number' && schedule.hoursPerDay > 0) return schedule.hoursPerDay;
            const start = new Date(schedule.startDatetime).getTime();
            const end = new Date(schedule.endDatetime).getTime();
            const diffHours = (end - start) / (1000 * 60 * 60);
            return Number.isFinite(diffHours) && diffHours > 0 ? diffHours : 0;
        };

        const hours7d = withDates
            .filter(({ start }) => start >= now && start <= horizon7d)
            .reduce((acc, { schedule }) => acc + getScheduleHours(schedule), 0);

        const hours30d = withDates
            .filter(({ start }) => start >= now && start <= horizon30d)
            .reduce((acc, { schedule }) => acc + getScheduleHours(schedule), 0);

        return {
            nextShift,
            lastShift,
            weekCount,
            monthCount,
            hours7d,
            hours30d,
        };
    }, [schedules]);

    const assignedSchedules = useMemo(
        () => [...schedules].sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()),
        [schedules],
    );

    const profileUser = detailedUser ?? user;

    if (!open || !profileUser) return null;

    const bgColor = getAvatarColor(profileUser.name);
    const initials = getInitials(profileUser.name);
    const status = (profileUser as User).status;
    const employeeId = (profileUser as User).employeeId;
    const branch = (profileUser as User).branch;
    const lastLoginAt = (profileUser as User).lastLoginAt;
    const failedAttempts = (profileUser as User).failedAttempts;
    const passwordChangeState = resolvePasswordChangeState(profileUser as User);

    const accountStatusLabel = status ? STATUS_LABELS[status] : 'No disponible';
    const forcedPasswordLabel = passwordChangeState === 'required'
        ? 'Obligatorio'
        : passwordChangeState === 'warning'
          ? 'Aviso'
          : 'No';

    const tabButtonClass = (tab: ProfileTab) => (
        `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === tab
                ? 'bg-gray-800 text-white shadow-sm'
                : 'bg-theme-surface-muted text-theme-muted hover:bg-gray-100 hover:text-theme-primary'
        }`
    );

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1.5px] animate-fade-in">
            <div className="card relative rounded-[28px] shadow-2xl w-full max-w-2xl h-[90vh] max-h-190 overflow-hidden animate-slide-up border border-theme-color/60">
                {/* Header/Cover */}
                <div className="h-32 bg-linear-to-br from-gray-900 via-gray-800 to-gray-700 relative overflow-hidden">
                    <div className="absolute -top-10 -left-8 h-28 w-28 rounded-full bg-white/10" />
                    <div className="absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-white/10" />
                    <div className="absolute top-4 right-24 h-14 w-14 rotate-12 rounded-2xl border border-white/20" />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-gray-800/80 hover:bg-gray-900 text-white rounded-xl transition-colors z-10 shadow-lg border border-white/20"
                        aria-label="Cerrar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Profile Content */}
                <div className="px-6 md:px-7 pb-6 pt-0 -mt-12 relative flex h-[calc(100%-128px)] flex-col">
                    {profileUser.avatarUrl ? (
                        <img
                            src={profileUser.avatarUrl}
                            alt={`Avatar de ${profileUser.name}`}
                            className="h-24 w-24 rounded-3xl object-cover shadow-xl border-4 border-white mb-4"
                        />
                    ) : (
                        <div
                            className="h-24 w-24 rounded-3xl flex items-center justify-center text-2xl font-bold text-white shadow-xl border-4 border-white mb-4 bg-gray-500"
                            style={{ backgroundColor: bgColor }}
                        >
                            {initials}
                        </div>
                    )}

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black tracking-tight text-theme-primary">{profileUser.name}</h2>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className={cn('badge-role-employee', (profileUser as User).role?.name === 'admin' && 'badge-role-admin', ((profileUser as User).role?.name === 'general_manager' || (profileUser as User).role?.name === 'department_manager') && 'badge-role-manager')}>
                                {ROLE_LABELS[(profileUser as User).role?.name] || (profileUser as User).role?.name}


                            </span>
                            {status && (
                                <span className={`badge-status-${status}`}>
                                    {STATUS_LABELS[status]}
                                </span>
                            )}
                            {(profileUser as User).department?.name && (
                                <span className="text-xs text-theme-muted bg-theme-surface-muted px-2 py-0.5 rounded-full">
                                    {(profileUser as User).department?.name}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex flex-1 min-h-0 flex-col">
                        <div className="rounded-2xl bg-theme-surface-muted/70 border border-theme-color p-1 inline-flex gap-1 self-start">
                            <button type="button" onClick={() => handleSetTab('general')} className={tabButtonClass('general')}>
                                General
                            </button>
                            <button type="button" onClick={() => handleSetTab('schedules')} className={tabButtonClass('schedules')}>
                                Guardias
                            </button>
                            <button type="button" onClick={() => handleSetTab('skills')} className={tabButtonClass('skills')}>
                                Skills
                            </button>
                            {canViewSecurityTab && (
                                <button type="button" onClick={() => handleSetTab('security')} className={tabButtonClass('security')}>
                                    Seguridad
                                </button>
                            )}
                        </div>

                        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                            {activeTab === 'general' && (
                                <div className="animate-fade-in rounded-3xl border border-theme-color bg-linear-to-b from-white to-theme-surface-muted/30 p-5 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                        <div className="border-b border-theme-color/60 pb-3">
                                            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">ID empleado</p>
                                            <p className="mt-1 text-base font-semibold text-theme-primary">{employeeId || 'No asignado'}</p>
                                        </div>
                                        <div className="border-b border-theme-color/60 pb-3">
                                            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">Sucursal asignada</p>
                                            <p className="mt-1 text-base font-semibold text-theme-primary">{branch ? `${branch.name} (${branch.code})` : 'Sin sucursal'}</p>
                                        </div>
                                        <div className="border-b border-theme-color/60 pb-3 md:col-span-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Mail className="h-3.5 w-3.5 text-theme-muted" />
                                                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">Email</p>
                                            </div>
                                            <p className="text-base font-semibold text-theme-primary truncate">{profileUser.email}</p>
                                        </div>
                                        <div className="border-b border-theme-color/60 pb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Phone className="h-3.5 w-3.5 text-theme-muted" />
                                                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">Empresa</p>
                                            </div>
                                            <p className="text-base font-semibold text-theme-primary">{(profileUser as User).companyPhone || '-'}</p>
                                        </div>
                                        <div className="border-b border-theme-color/60 pb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Phone className="h-3.5 w-3.5 text-theme-muted" />
                                                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">Auxiliar</p>
                                            </div>
                                            <p className="text-base font-semibold text-theme-primary">{(profileUser as User).auxiliaryPhone || '-'}</p>
                                        </div>
                                        <div className="border-b border-theme-color/60 pb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CalendarDays className="h-3.5 w-3.5 text-theme-muted" />
                                                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">En el sistema desde</p>
                                            </div>
                                            <p className="text-base font-semibold text-theme-primary">{(profileUser as User).createdAt ? formatDate((profileUser as User).createdAt) : '-'}</p>
                                        </div>
                                        <div className="border-b border-theme-color/60 pb-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock3 className="h-3.5 w-3.5 text-theme-muted" />
                                                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-theme-muted">Último acceso</p>
                                            </div>
                                            <p className="text-base font-semibold text-theme-primary">{lastLoginAt ? `${formatRelative(lastLoginAt)} (${formatDateTime(lastLoginAt)})` : 'Nunca'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'schedules' && (
                                <div className="animate-fade-in rounded-3xl border border-theme-color bg-linear-to-b from-white to-theme-surface-muted/30 p-5 md:p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Activity className="h-4 w-4 text-gray-600" />
                                        <p className="text-base font-bold text-theme-primary">Actividad de guardias</p>
                                    </div>
                                    {loadingSchedules && canLoadSchedules ? (
                                        <p className="text-xs text-theme-muted">Cargando actividad...</p>
                                    ) : (
                                        <div className="space-y-5">
                                            <div className="pl-4 border-l-4 border-gray-300">
                                                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-theme-muted">Próxima guardia</p>
                                                <p className="mt-1 text-base font-semibold text-theme-primary">{metrics.nextShift ? formatDateTime(metrics.nextShift.startDatetime) : 'Sin próximas guardias'}</p>
                                            </div>
                                            <div className="pl-4 border-l-4 border-gray-300">
                                                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-theme-muted">Última guardia</p>
                                                <p className="mt-1 text-base font-semibold text-theme-primary">{metrics.lastShift ? formatDateTime(metrics.lastShift.endDatetime) : 'Sin guardias previas'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                                                <div className="rounded-2xl bg-gray-50 border border-gray-200 px-3 py-3">
                                                    <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Semana</p>
                                                    <p className="text-xl font-black text-gray-800 mt-1">{metrics.weekCount}</p>
                                                </div>
                                                <div
                                                    className={cn(
                                                        'rounded-2xl border px-3 py-3',
                                                        'bg-gray-50 border-gray-200',
                                                    )}
                                                >
                                                    <p
                                                        className={cn(
                                                            'text-[10px] uppercase tracking-[0.15em]',
                                                            'text-gray-500',
                                                        )}
                                                    >
                                                        Mes
                                                    </p>
                                                    <p
                                                        className={cn(
                                                            'text-xl font-black mt-1',
                                                            'text-gray-800',
                                                        )}
                                                    >
                                                        {metrics.monthCount}
                                                    </p>
                                                </div>
                                                <div
                                                    className={cn(
                                                        'rounded-2xl border px-3 py-3',
                                                        'bg-emerald-50 border-emerald-100',
                                                    )}
                                                >
                                                    <p
                                                        className={cn(
                                                            'text-[10px] uppercase tracking-[0.15em]',
                                                            'text-emerald-700',
                                                        )}
                                                    >
                                                        Horas 7d
                                                    </p>
                                                    <p
                                                        className={cn(
                                                            'text-xl font-black mt-1',
                                                            'text-emerald-800',
                                                        )}
                                                    >
                                                        {metrics.hours7d.toFixed(1)}h
                                                    </p>
                                                </div>
                                                <div
                                                    className={cn(
                                                        'rounded-2xl border px-3 py-3',
                                                        'bg-cyan-50 border-cyan-100',
                                                    )}
                                                >
                                                    <p
                                                        className={cn(
                                                            'text-[10px] uppercase tracking-[0.15em]',
                                                            'text-cyan-700',
                                                        )}
                                                    >
                                                        Horas 30d
                                                    </p>
                                                    <p
                                                        className={cn(
                                                            'text-xl font-black mt-1',
                                                            'text-cyan-800',
                                                        )}
                                                    >
                                                        {metrics.hours30d.toFixed(1)}h
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-theme-color bg-white/80 p-4 md:p-5">
                                                <div className="flex items-center justify-between gap-3 mb-4">
                                                    <div>
                                                        <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-theme-muted">Eventos asignados</p>
                                                        <p className="text-sm text-theme-muted mt-1">{assignedSchedules.length} turno{assignedSchedules.length === 1 ? '' : 's'} vinculados a este usuario</p>
                                                    </div>
                                                </div>

                                                {assignedSchedules.length === 0 ? (
                                                    <p className="text-sm text-theme-muted">No hay eventos asignados para este usuario.</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {assignedSchedules.map((schedule) => (
                                                            <div
                                                                key={schedule.id}
                                                                className="flex items-start gap-3 rounded-2xl border border-theme-color/80 bg-theme-surface-muted/40 px-4 py-3"
                                                            >
                                                                <div
                                                                    className="mt-1 h-3 w-3 rounded-full shrink-0"
                                                                    style={{ backgroundColor: schedule.color || '#1e3a5f' }}
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="text-sm font-semibold text-theme-primary">{schedule.title}</p>
                                                                        {schedule.isLastMinute && (
                                                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                                                                                Urgente
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="mt-1 text-xs text-theme-muted">
                                                                        {formatDateTime(schedule.startDatetime)} — {formatDateTime(schedule.endDatetime)}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-theme-muted">
                                                                        {schedule.location || schedule.notes || 'Sin ubicación ni notas adicionales'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'skills' && (
                                <div className="animate-fade-in rounded-3xl border border-theme-color bg-linear-to-b from-white to-theme-surface-muted/30 p-5 md:p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Zap className="h-4 w-4 text-theme-muted" />
                                        <p className="text-base font-bold text-theme-primary">Habilidades y Competencias</p>
                                    </div>
                                    {loadingUserDetail ? (
                                        <p className="text-xs text-theme-muted">Cargando habilidades...</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {!(profileUser as User).skills?.length ? (
                                                <p className="text-sm text-theme-muted italic">No se han asignado habilidades a este perfil.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {(profileUser as User).skills?.map((item) => (
                                                        <div
                                                            key={item.skill.id}
                                                            className="flex items-center gap-3 rounded-2xl border border-theme-color/80 bg-theme-surface-muted/40 px-4 py-3"
                                                        >
                                                            <div
                                                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                                                style={{ backgroundColor: item.skill.color }}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-theme-primary truncate">{item.skill.name}</p>
                                                                {item.skill.category && (
                                                                    <p className="text-[10px] uppercase tracking-wider text-theme-muted font-bold">{item.skill.category}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {canViewSecurityTab && activeTab === 'security' && (
                                <div className="animate-fade-in rounded-3xl border border-theme-color bg-linear-to-b from-white to-theme-surface-muted/30 p-5 md:p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <ShieldAlert
                                            className={cn('h-4 w-4 text-red-500')}
                                        />
                                        <p className="text-base font-bold text-theme-primary">Seguridad y soporte</p>
                                    </div>
                                    {loadingUserDetail && canLoadPrivateData ? (
                                        <p className="text-xs text-theme-muted">Cargando estado de seguridad...</p>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-theme-color/60 pb-3">
                                                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-theme-muted">Estado de cuenta</p>
                                                <span className="text-base font-semibold text-theme-primary">{accountStatusLabel}</span>
                                            </div>
                                            <div className="flex items-center justify-between border-b border-theme-color/60 pb-3">
                                                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-theme-muted">Intentos fallidos</p>
                                                <span className="text-base font-semibold text-theme-primary">{typeof failedAttempts === 'number' ? failedAttempts : 0}</span>
                                            </div>
                                            <div
                                                className={cn(
                                                    'flex items-center justify-between rounded-2xl px-3 py-2.5 border',
                                                    'bg-red-50 border border-red-100',
                                                )}
                                            >
                                                <p
                                                    className={cn(
                                                        'text-[11px] uppercase tracking-[0.16em] font-bold',
                                                        'text-red-600',
                                                    )}
                                                >
                                                    Cambio de contraseña forzado
                                                </p>
                                                <span
                                                    className={cn(
                                                        'text-base font-black',
                                                        'text-red-700',
                                                    )}
                                                >
                                                    {forcedPasswordLabel}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

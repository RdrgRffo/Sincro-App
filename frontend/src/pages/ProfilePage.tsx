import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

import api from '@/config/api';
import { ROLE_LABELS } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ProfileSkeleton } from '@/components/common/Skeleton';
import { getInitials, getAvatarColor, formatDate } from '@/lib/utils';

import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Requerido'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type PwForm = z.infer<typeof pwSchema>;

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const { accessToken, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showPwForm, setShowPwForm] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  });

  const changePwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente');
      setShowPwForm(false);
      reset();
      if (user && accessToken && refreshToken) {
        setAuth(
          {
            ...user,
            forcePasswordChange: false,
            passwordChangePolicy: 'none',
            passwordChangeState: 'none',
            passwordChangeWarnedAt: null,
            passwordChangeDeadlineAt: null,
          },
          accessToken,
          refreshToken
        );
      }
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error')),
  });

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken: useAuthStore.getState().refreshToken });
    } catch { /* ignore */ }
    logout();
    navigate('/login');
    toast.success('Sesión cerrada');
  };

  if (!user) return <ProfileSkeleton />;

  const bgColor = getAvatarColor(user.name);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mi Perfil</h1>
        <p className="text-sm text-gray-400 mt-1.5">Gestiona tu información y seguridad</p>
      </div>



      {/* Profile card */}
      <div className="card p-7">
        <div className="flex items-center gap-5">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-theme-primary">{user.name}</h2>
            <p className="text-theme-muted text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge-role-${user.role?.name}`}>{ROLE_LABELS[user.role?.name]}</span>
              {user.department && (
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{user.department.name}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Miembro desde</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{formatDate(user.createdAt)}</p>
          </div>
          {user.lastLoginAt && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Último acceso</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{formatDate(user.lastLoginAt)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Teléfono Empresa</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{user.companyPhone || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Teléfono Auxiliar</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{user.auxiliaryPhone || '-'}</p>
          </div>
        </div>
      </div>

      {/* Role info */}
      <div className="card p-7">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">Permisos de acceso</h3>
        </div>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Ver planificación de guardias
          </div>
          {(user.role?.name === 'admin' || user.role?.name === 'general_manager' || user.role?.name === 'department_manager') && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Crear y modificar guardias
            </div>
          )}
          {user.role?.name === 'admin' && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Gestión completa de usuarios
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Acceso al registro de auditoría
              </div>
            </>
          )}
          {user.role?.name === 'admin' && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Gestión completa de webhooks (CRUD) y notificaciones a Teams: historial global, envíos manuales y reenvíos a cualquier webhook
            </div>
          )}
          {user.role?.name === 'general_manager' && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Notificaciones a Teams de su sede: historial y envíos manuales (sin configuración de webhooks)
            </div>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="card p-7">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-700">Cambiar Contraseña</h3>
          </div>
          <button onClick={() => setShowPwForm((v) => !v)} className="btn-ghost text-xs">
            {showPwForm ? 'Cancelar' : 'Cambiar'}
          </button>
        </div>

        {showPwForm && (
          <form onSubmit={handleSubmit((d) => changePwMutation.mutate(d))} className="space-y-4 animate-slide-down">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña actual</label>
              <input {...register('currentPassword')} type="password" className="input-field text-sm" placeholder="••••••••" />
              {errors.currentPassword && <p className="text-xs text-red-500 mt-1">{errors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
              <input {...register('newPassword')} type="password" className="input-field text-sm" placeholder="Mínimo 8 caracteres" />
              {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña</label>
              <input {...register('confirmPassword')} type="password" className="input-field text-sm" placeholder="Repite la contraseña" />
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
            </div>
            <button
              type="submit"
              disabled={changePwMutation.isPending}
              className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {changePwMutation.isPending && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
              Actualizar contraseña
            </button>
          </form>
        )}
        {!showPwForm && (
          <p className="text-xs text-gray-400">Tu contraseña fue actualizada hace poco. Mantenla segura.</p>
        )}
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <User className="h-4 w-4 text-gray-400 shrink-0" />
        <p className="text-sm text-gray-500">Para cambiar tu email, nombre o rol, contacta con el administrador del sistema.</p>
      </div>

      {/* Logout button — visible on mobile, hidden on desktop (sidebar has it) */}
      <div className="md:hidden">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-200 text-red-500 bg-red-50 text-sm font-semibold hover:bg-red-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
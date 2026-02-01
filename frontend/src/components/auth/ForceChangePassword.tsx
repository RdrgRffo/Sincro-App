import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/config/api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { SincroLogo } from '@/components/common/SincroLogo';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((d) => d.newPassword !== d.currentPassword, {
  message: 'La nueva contraseña no puede ser igual a la anterior',
  path: ['newPassword'],
});

type PwForm = z.infer<typeof pwSchema>;

export function ForceChangePassword() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const { accessToken, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  });

  const changePwMutation = useMutation({
    mutationFn: (data: PwForm) =>
      api.patch('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente');
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
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error al cambiar contraseña')),
  });

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-surface-muted p-4">
      <div className="w-full max-w-md bg-theme-surface rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-theme-color">
        <div className="bg-gray-900 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-navy-900" />
          <div className="relative z-10 flex justify-center mb-4">
            <SincroLogo size="md" />
          </div>
          <h2 className="text-xl font-bold text-white relative z-10">Cambio Obligatorio</h2>
          <p className="text-sm text-slate-200/95 mt-2 relative z-10">
            Hola {user?.name}, para tu seguridad es necesario cambiar la contraseña.
          </p>
        </div>
        
        <div className="p-8">
          <div className="flex bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200 text-left">
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-3 shrink-0" />
            <p className="text-sm text-amber-800">
              No podrás acceder a la aplicación hasta que establezcas una nueva contraseña segura.
            </p>
          </div>

          <form onSubmit={handleSubmit((d) => changePwMutation.mutate(d))} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1">Contraseña actual</label>
              <input 
                {...register('currentPassword')} 
                type="password" 
                className="input-field" 
                placeholder="Escribe tu contraseña actual" 
              />
              {errors.currentPassword && <p className="text-xs text-red-500 mt-1">{errors.currentPassword.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1">Nueva contraseña</label>
              <input 
                {...register('newPassword')} 
                type="password" 
                className="input-field" 
                placeholder="Mínimo 8 caracteres" 
              />
              {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1">Confirmar nueva contraseña</label>
              <input 
                {...register('confirmPassword')} 
                type="password" 
                className="input-field" 
                placeholder="Repite la nueva contraseña" 
              />
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
            </div>
            
            <button
              type="submit"
              disabled={changePwMutation.isPending}
              className="mt-2 w-full btn-primary py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {changePwMutation.isPending && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
              Actualizar y continuar
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={handleLogout} className="text-sm text-theme-muted hover:text-theme-primary font-medium flex items-center justify-center gap-2 mx-auto">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Users, Clock3, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SincroLogo } from '@/components/common/SincroLogo';
import { useAuthStore } from '@/store/authStore';
import api from '@/config/api';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Correo o usuario requerido')
    .refine((value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[A-Za-z0-9._-]{3,64}$/;
      return emailRegex.test(value) || usernameRegex.test(value);
    }, 'Ingresa un correo o usuario válido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const clearAuthError = () => {
    if (authError) {
      setAuthError(null);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    try {
      setAuthError(null);
      const identifier = data.identifier.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[A-Za-z0-9._-]{3,64}$/;

      if (!emailRegex.test(identifier) && !usernameRegex.test(identifier)) {
        const invalidIdentifierMessage = 'Ingresa un correo o usuario válido';
        setAuthError(invalidIdentifierMessage);
        toast.error(invalidIdentifierMessage);
        return;
      }

      const payload = { identifier, password: data.password };

      const res = await api.post('/auth/login', payload);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success(`Bienvenido, ${user.name}`);
      navigate('/');
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Error al iniciar sesión');
      setAuthError(message);
      toast.error(message);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-gray-700 to-gray-500" />
        <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-gray-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gray-300/20 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-[#B4B5DF]/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(217,230,242,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(217,230,242,0.04)_1px,transparent_1px)] bg-size-[38px_38px]" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center p-4 sm:p-6 lg:p-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/20 bg-white/3 shadow-[0_24px_72px_rgba(6,14,24,0.55)] backdrop-blur-sm lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative border-b border-white/10 p-7 text-white sm:p-9 lg:border-b-0 lg:border-r">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[36px] border-b border-l border-white/10 bg-white/5" />

            <div className="flex items-center gap-3">
              <SincroLogo size="md" />
              <div>
                <h1 className="text-lg font-semibold">Coordinación de equipos</h1>
              </div>
            </div>

            <div className="mt-10 max-w-lg">
              <p className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Coordinación operativa, auditoría y notificaciones en una sola plataforma.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-200/95">
                Gestiona turnos, auditoría y notificaciones en una plataforma unificada para equipos críticos.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Colaboración de Equipos</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-200/90">
                      Roles y permisos claros para operaciones seguras.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Cobertura 24/7</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-200/90">
                      Asignaciones semanales con respuesta rápida a cambios.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  <div>
                    <p className="text-sm font-semibold text-white">Trazabilidad Completa</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-200/90">
                      Registro de actividad y reportes para control interno.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-10 text-xs text-white/55">© {new Date().getFullYear()} Sincro | Coordinación operativa</p>
          </section>

          <section className="border-t border-theme-color bg-theme-surface p-7 sm:p-9 lg:border-l lg:border-t-0">
            <div className="mx-auto max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">Acceso Seguro</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-theme-primary">Iniciar Sesión</h2>
              <p className="mt-2 text-sm text-theme-muted">Ingresa tus credenciales para continuar.</p>

              {authError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className={cn('mt-5 rounded-xl border px-3.5 py-3 border-red-200 bg-red-50 text-red-800')}
                >
                  <p className="text-sm font-medium">{authError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-medium text-theme-primary">
                    Correo o usuario
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" />
                    <input
                      {...register('identifier', { onChange: clearAuthError })}
                      id="login-identifier"
                      type="text"
                      placeholder="usuario@dominio.com o usuario"
                      className="input-field pl-9!"
                      autoComplete="username"
                      autoFocus
                      aria-invalid={Boolean(errors.identifier)}
                      aria-describedby={errors.identifier ? 'login-identifier-error' : undefined}
                    />
                  </div>
                  {errors.identifier && (
                    <p id="login-identifier-error" className="mt-1.5 text-xs font-medium text-red-700">
                      {errors.identifier.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-theme-primary">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" />
                    <input
                      {...register('password', { onChange: clearAuthError })}
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-9! pr-14!"
                      autoComplete="current-password"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'login-password-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-theme-muted transition-colors hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/80"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="login-password-error" className="mt-1.5 text-xs font-medium text-red-700">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[9px] bg-gray-500 px-4 pt-3 pb-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-600 disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:ring-offset-(--theme-surface)"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white border-t-white/40" />
                      Iniciando sesión...
                    </>
                  ) : (
                    'Ingresar al sistema'
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-theme-color bg-theme-surface-muted px-4 py-3">
                <p className="text-xs leading-relaxed text-theme-muted">
                  Acceso restringido a personal autorizado. Si no puedes ingresar, contacta al administrador.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
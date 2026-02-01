import { useState } from 'react';
import { X, Key, Eye, EyeOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/config/api';
import type { User } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';

interface Props { open: boolean; user: User; onClose: () => void; }

export function ResetPasswordModal({ open, user, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const hasMinLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isStrongEnough = hasMinLength && hasLower && hasUpper && hasNumber;

  const mutation = useMutation({
    mutationFn: () => api.post(`/users/${user.id}/reset-password`, { newPassword: password }),
    onSuccess: () => { toast.success('Contraseña restablecida'); onClose(); setPassword(''); },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Error')),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-color">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-gray-600" />
            <h2 className="text-base font-semibold text-theme-primary">Resetear Contraseña</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-theme-muted">
            Establecer nueva contraseña para <strong>{user.name}</strong>.
            El usuario deberá cambiarla en el próximo inicio de sesión.
          </p>
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-10"
                placeholder="Mínimo 8 caracteres"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-theme-muted">
              Debe tener 8+ caracteres, mayúscula, minúscula y número.
            </p>
            {password.length > 0 && !isStrongEnough && (
              <p className="mt-1 text-xs text-red-500">
                La contraseña no cumple los requisitos mínimos.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn-ghost text-sm">Cancelar</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!isStrongEnough || mutation.isPending}
              className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {mutation.isPending && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
              Restablecer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

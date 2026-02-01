import { ShieldOff, ArrowLeft, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface ForbiddenPageProps {
  /** Mensaje descriptivo del error (opcional) */
  message?: string;
  /** Si es true, muestra botón para volver al login */
  showLoginButton?: boolean;
}

/**
 * Página de error 403 — Acceso denegado.
 * Se muestra cuando el usuario no tiene permisos para acceder a un recurso.
 */
export function ForbiddenPage({
  message = 'No tienes permisos para acceder a esta sección.',
  showLoginButton = false,
}: ForbiddenPageProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="p-5 bg-red-50 rounded-full mb-6">
        <ShieldOff className="h-12 w-12 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Acceso denegado
      </h1>

      <p className="text-sm text-gray-500 max-w-md mb-2">
        {message}
      </p>

      {user && (
        <p className="text-xs text-gray-400 mb-8">
          Tu rol actual: <span className="font-medium text-gray-600">{user.role?.name}</span>
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver atrás
        </button>

        {showLoginButton && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
}

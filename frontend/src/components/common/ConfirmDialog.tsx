import { AlertTriangle, X } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`h-5 w-5 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-theme-primary">{title}</h3>
            <p className="mt-1 text-sm text-theme-muted">{description}</p>
          </div>
          <button onClick={onCancel} className="text-theme-muted hover:text-theme-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 text-sm font-semibold py-2 px-4 rounded-lg transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            } disabled:opacity-60`}
          >
            {loading && <LoadingSpinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

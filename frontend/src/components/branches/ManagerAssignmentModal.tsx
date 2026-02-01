import { X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { Branch, User } from '@/types';

interface ManagerAssignmentModalProps {
  open: boolean;
  branch: Branch;
  users: User[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  onAssign: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ManagerAssignmentModal({
  open,
  branch,
  users,
  selectedUserId,
  onSelectUser,
  onAssign,
  onCancel,
  isLoading,
}: ManagerAssignmentModalProps) {
  if (!open) return null;

  const canAssign = Boolean(selectedUserId) && !isLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-xl shadow-2xl max-w-lg w-full p-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-semibold text-theme-primary">Asignar gerente general (GM)</h3>
            <p className="text-sm text-theme-muted">
              El usuario pasará a rol <strong className="text-theme-primary">gerente general</strong>, quedará vinculado a{' '}
              <strong className="text-theme-primary">{branch.name}</strong> y será el responsable de la sucursal en la ficha.
            </p>
          </div>
          <button onClick={onCancel} className="text-theme-muted hover:text-theme-primary" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-theme-muted">
            Usuario
          </label>
          <select
            value={selectedUserId}
            onChange={(event) => onSelectUser(event.target.value)}
            className="w-full rounded-lg border border-theme-color bg-theme-surface px-3 py-2 text-sm text-theme-primary outline-none focus:ring-2 focus:ring-theme-color"
          >
            <option value="">Selecciona un usuario</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {user.email}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-ghost text-sm" type="button">
            Cancelar
          </button>
          <button
            onClick={onAssign}
            disabled={!canAssign}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
            type="button"
          >
            {isLoading && <LoadingSpinner size="sm" className="border-white border-t-white/30" />}
            Asignar
          </button>
        </div>
      </div>
    </div>
  );
}
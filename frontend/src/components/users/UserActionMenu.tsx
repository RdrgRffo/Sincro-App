import { Eye, Edit, Key, Shield, Lock, Unlock, RotateCcw, Trash2 } from 'lucide-react';
import type { User } from '@/types';

interface UserActionMenuProps {
  user: User;
  isAdmin: boolean;
  roleName?: string;
  canEdit?: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onViewDetail: (user: User) => void;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
  onForcePasswordChange: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onReactivate?: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserActionMenu({
  user,
  isAdmin,
  roleName,
  canEdit,
  position,
  onClose,
  onViewDetail,
  onEdit,
  onResetPassword,
  onForcePasswordChange,
  onToggleStatus,
  onReactivate,
  onDelete,
}: UserActionMenuProps) {
  const isDepartmentManager = roleName === 'department_manager';
  const isGeneralManager = roleName === 'general_manager';
  const canEditUser = typeof canEdit === 'boolean' ? canEdit : (isAdmin || isGeneralManager || isDepartmentManager);

  return (
    <>
      <div
        className="fixed card rounded-xl shadow-xl border border-theme-color z-50 w-48 py-1 animate-slide-down"
        style={{ top: position.top, left: position.left }}
      >
        <button
          onClick={() => { onViewDetail(user); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
        >
          <Eye className="h-3.5 w-3.5" />Ver detalle
        </button>
        {canEditUser && (
          <button
            onClick={() => { onEdit(user); onClose(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-primary hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <Edit className="h-3.5 w-3.5" />Editar
          </button>
        )}
        {isAdmin && (
          <>
            <button
              onClick={() => { onResetPassword(user); onClose(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-primary hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <Key className="h-3.5 w-3.5" />Resetear contraseña
            </button>
            <button
              onClick={() => { onForcePasswordChange(user); onClose(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-primary hover:bg-sky-50 hover:text-sky-700 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />Forzar cambio de contraseña
            </button>
            {user.status === 'active' ? (
              <button
                onClick={() => { onToggleStatus(user); onClose(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-amber-50 text-amber-700"
              >
                <Lock className="h-3.5 w-3.5" />Bloquear
              </button>
            ) : (
              <button
                onClick={() => { onToggleStatus(user); onClose(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-700 hover:bg-green-50 hover:text-green-800 transition-colors"
              >
                <Unlock className="h-3.5 w-3.5" />Activar
              </button>
            )}
            {user.status === 'disabled' && onReactivate ? (
              <button
                onClick={() => { onReactivate(user); onClose(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-700 hover:bg-green-50 hover:text-green-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />Reactivar
              </button>
            ) : null}
            <hr className="border-gray-100 my-1" />
            <button
              onClick={() => { onDelete(user); onClose(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-red-50 text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />Eliminar
            </button>
          </>
        )}
      </div>
      <div className="fixed inset-0 z-40" onClick={onClose} />
    </>
  );
}

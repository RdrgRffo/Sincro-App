import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, X } from 'lucide-react';
import api from '@/config/api';
import type { Schedule, User } from '@/types';
import { ROLE_LABELS } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatDateTime } from '@/lib/utils';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError';

interface UserDetailsModalProps {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
}

type TabKey = 'profile' | 'schedules';

export function UserDetailsModal({ open, userId, userName, onClose }: UserDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  const { data: user, isLoading: loadingUser, isError: isUserError, error: userError } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => api.get<{ data: User }>(`/users/${userId}`).then((r) => r.data.data),
    enabled: open,
    retry: false,
  });

  const {
    data: schedules,
    isLoading: loadingSchedules,
    isError: isSchedulesError,
    error: schedulesError,
  } = useQuery({
    queryKey: ['user-schedules', userId],
    queryFn: () => api.get<{ data: Schedule[] }>(`/users/${userId}/schedules`).then((r) => r.data.data),
    enabled: open && activeTab === 'schedules',
    retry: false,
  });

  const userErrorCode = getApiErrorCode(userError);
  const userErrorMessage = getApiErrorMessage(userError, 'No se pudo cargar el usuario.');
  const schedulesErrorCode = getApiErrorCode(schedulesError);
  const schedulesErrorMessage = getApiErrorMessage(schedulesError, 'No se pudieron cargar las guardias.');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Detalle de usuario</h2>
            <p className="text-xs text-gray-400 mt-0.5">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 transition-colors ${activeTab === 'profile' ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              Perfil
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedules')}
              className={`px-4 py-2 transition-colors ${activeTab === 'schedules' ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              Guardias
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-150px)]">
          {activeTab === 'profile' && (
            <>
              {loadingUser ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner />
                </div>
              ) : isUserError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {userErrorCode === 'NOT_FOUND' ? 'Usuario no encontrado.' : 'Error al cargar perfil.'}
                  </p>
                  <p className="mt-1 text-xs text-red-600">
                    {userErrorCode === 'VALIDATION_ERROR'
                      ? 'El identificador enviado no es válido.'
                      : userErrorMessage}
                  </p>
                </div>
              ) : !user ? (
                <p className="text-sm text-gray-400">No se pudo cargar el usuario.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 p-4 md:col-span-2">
                    <p className="text-xs text-gray-400 mb-1">ID Empleado</p>
                    <p className="text-sm font-mono font-medium text-gray-700">{user.employeeId || 'No asignado'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">Nombre</p>
                    <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-700">{user.email}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">Rol</p>
                    <p className="text-sm font-medium text-gray-700">{ROLE_LABELS[user.role?.name] || user.role?.name}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-400 mb-1">Estado</p>
                    <p className="text-sm font-medium text-gray-700">{user.status}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 md:col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Departamento</p>
                    <p className="text-sm font-medium text-gray-700">
                      {user.department?.name || 'Sin departamento'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 md:col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Sucursal</p>
                    <p className="text-sm font-medium text-gray-700">
                      {user.branch ? `${user.branch.name} (${user.branch.code})` : 'Sin sucursal asignada'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'schedules' && (
            <>
              {loadingSchedules ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner />
                </div>
              ) : isSchedulesError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {schedulesErrorCode === 'NOT_FOUND'
                      ? 'No se encontró el usuario para consultar guardias.'
                      : 'Error al cargar guardias.'}
                  </p>
                  <p className="mt-1 text-xs text-red-600">
                    {schedulesErrorCode === 'VALIDATION_ERROR'
                      ? 'Parámetros inválidos al consultar guardias.'
                      : schedulesErrorMessage}
                  </p>
                </div>
              ) : !schedules?.length ? (
                <p className="text-sm text-gray-400">Sin guardias para este usuario.</p>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">{schedule.title}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDateTime(schedule.startDatetime)} - {formatDateTime(schedule.endDatetime)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">
                          <Calendar className="h-3 w-3" />
                          {schedule.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

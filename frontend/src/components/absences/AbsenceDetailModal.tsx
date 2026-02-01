import type { AbsenceKind, AbsenceRequest } from '@/types';
import { ABSENCE_KIND_LABELS } from '@/lib/absenceKinds';
import { AbsenceStatusBadge } from './AbsenceStatusBadge';
import {
  X,
  Calendar,
  MapPin,
  Building2,
  MessageSquare,
  UserCheck,
  UserX,
  Trash2,
  Check,
  Tag,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function absenceKindLabel(type: AbsenceKind | undefined): string | null {
  if (!type) return null;
  return ABSENCE_KIND_LABELS[type] ?? type;
}

interface AbsenceDetailModalProps {
  open: boolean;
  onClose: () => void;
  absence: AbsenceRequest | null;
  isLoading?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  canApprove?: boolean;
  canCancel?: boolean;
  isActionPending?: boolean;
}

export function AbsenceDetailModal({
  open,
  onClose,
  absence,
  isLoading,
  onApprove,
  onReject,
  onCancel,
  canApprove,
  canCancel,
  isActionPending,
}: AbsenceDetailModalProps) {
  if (!open) return null;

  const formatDate = (date: string) => format(new Date(date), "d 'de' MMMM, yyyy", { locale: es });
  const formatDateTime = (date: string) =>
    format(new Date(date), "d 'de' MMMM yyyy, HH:mm", { locale: es });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="card border border-theme-color rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-slide-up bg-theme-surface">
        <div className="p-6 flex justify-between items-start border-b border-theme-color bg-theme-surface-muted/30">
          <div>
            <h2 className="text-xl font-bold text-theme-primary">Detalle de la ausencia</h2>
            <p className="text-sm text-theme-muted mt-1">
              {absence && !isLoading ? `ID solicitud: ${absence.id.slice(-8).toUpperCase()}` : 'Cargando…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-theme-muted hover:text-theme-primary hover:bg-theme-surface-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {isLoading || !absence ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {absence.employee.avatarUrl ? (
                    <img
                      src={absence.employee.avatarUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover border border-theme-color shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-theme-primary/10 flex items-center justify-center text-theme-primary font-bold text-lg shrink-0">
                      {absence.employee.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-theme-primary truncate">{absence.employee.name}</div>
                    <div className="text-sm text-theme-muted truncate">{absence.employee.email}</div>
                  </div>
                </div>
                <AbsenceStatusBadge status={absence.status} className="shrink-0" />
              </div>

              {absence.status === 'colindante' && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex gap-3">
                  <Info className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">
                      Colindante
                    </p>
                    <p className="text-sm text-orange-900/90 mt-1">
                      Las fechas solapan con ausencias de compañeros del mismo departamento. Sigue pendiente de revisión
                      (aprobar, rechazar o cancelar si es tu solicitud).
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-theme-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-theme-muted uppercase">Fechas</p>
                    <p className="text-sm font-medium text-theme-primary">Desde: {formatDate(absence.startDate)}</p>
                    <p className="text-sm font-medium text-theme-primary">Hasta: {formatDate(absence.endDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-theme-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-theme-muted uppercase">Sucursal</p>
                    <p className="text-sm font-medium text-theme-primary">
                      {absence.branch?.name ? `${absence.branch.name} (${absence.branch.code})` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {absenceKindLabel(absence.type) ? (
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-theme-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-theme-muted uppercase">Tipo</p>
                    <p className="text-sm font-medium text-theme-primary">{absenceKindLabel(absence.type)}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-theme-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase">Departamento</p>
                  <p className="text-sm font-medium text-theme-primary">
                    {absence.department?.name ? `${absence.department.name} (${absence.department.code})` : '—'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-theme-muted border-t border-theme-color pt-3">
                Solicitud registrada el {formatDateTime(absence.createdAt)}
                {absence.updatedAt !== absence.createdAt ? (
                  <> · Última actualización {formatDateTime(absence.updatedAt)}</>
                ) : null}
              </p>

              {absence.note ? (
                <div className="rounded-xl border border-theme-color bg-theme-surface-muted/40 p-4 flex gap-3">
                  <MessageSquare className="h-5 w-5 text-theme-muted shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-theme-muted uppercase mb-1">Nota del empleado</p>
                    <p className="text-sm text-theme-primary italic">&ldquo;{absence.note}&rdquo;</p>
                  </div>
                </div>
              ) : null}

              {absence.status === 'rejected' && absence.rejectionReason ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
                  <UserX className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-red-600 uppercase mb-1">Motivo de rechazo</p>
                    <p className="text-sm text-red-800 font-medium">{absence.rejectionReason}</p>
                  </div>
                </div>
              ) : null}

              {(absence.status === 'approved' || absence.status === 'rejected') && absence.reviewer ? (
                <div className="flex items-center gap-2 text-xs text-theme-muted border-t border-theme-color pt-4">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span>
                    Revisado por <span className="font-semibold text-theme-primary">{absence.reviewer.name}</span> el{' '}
                    {absence.reviewedAt ? formatDate(absence.reviewedAt) : '—'}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!isLoading && absence && (canApprove || canCancel) ? (
          <div className="p-6 bg-theme-surface-muted/40 border-t border-theme-color flex flex-wrap gap-3 justify-end">
            {canCancel ? (
              <button
                type="button"
                onClick={() => onCancel?.(absence.id)}
                disabled={isActionPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-muted hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Cancelar solicitud
              </button>
            ) : null}
            {canApprove ? (
              <>
                <button
                  type="button"
                  onClick={() => onReject?.(absence.id)}
                  disabled={isActionPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 bg-theme-surface hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => onApprove?.(absence.id)}
                  disabled={isActionPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Aprobar
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

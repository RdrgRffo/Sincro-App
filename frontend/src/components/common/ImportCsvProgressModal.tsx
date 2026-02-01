import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportPhase {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  message?: string;
}

interface ImportCsvProgressModalProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  onRetry?: () => void;
  result?: {
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
  } | null;
  error?: string | null;
}

export function ImportCsvProgressModal({
  open,
  onClose,
  fileName,
  onRetry,
  result,
  error,
}: ImportCsvProgressModalProps) {
  const [phases, setPhases] = useState<ImportPhase[]>([
    { id: 'validate', label: 'Validando archivo CSV...', status: 'pending' },
    { id: 'import', label: 'Importando datos...', status: 'pending' },
    { id: 'process', label: 'Procesando resultados...', status: 'pending' },
  ]);

  useEffect(() => {
    if (!open) return;

    // Animar las fases secuencialmente
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      setPhases(prev => prev.map(p =>
        p.id === 'validate' ? { ...p, status: 'active' } : p
      ));
    }, 300));

    timers.push(setTimeout(() => {
      setPhases(prev => prev.map(p =>
        p.id === 'validate' ? { ...p, status: 'done' } :
        p.id === 'import' ? { ...p, status: 'active' } : p
      ));
    }, 1200));

    timers.push(setTimeout(() => {
      setPhases(prev => prev.map(p =>
        p.id === 'import' ? { ...p, status: 'done' } :
        p.id === 'process' ? { ...p, status: 'active' } : p
      ));
    }, 2500));

    return () => timers.forEach(t => clearTimeout(t));
  }, [open]);

  if (!open) return null;

  const isComplete = result !== undefined && result !== null;
  const isError = error !== undefined && error !== null;
  const totalProcessed = result
    ? result.created + result.updated + result.unchanged + result.failed
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-theme-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center',
              isError ? 'bg-red-100 dark:bg-red-900/30' :
              isComplete ? 'bg-green-100 dark:bg-green-900/30' :
              'bg-blue-100 dark:bg-blue-900/30'
            )}>
              {isError ? (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-theme-primary truncate">
                {isError ? 'Error en la importación' :
                 isComplete ? 'Importación completada' :
                 'Importando CSV'}
              </h3>
              <p className="text-sm text-theme-muted truncate">{fileName}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Fases */}
          <div className="space-y-3">
            {phases.map((phase) => (
              <div key={phase.id} className="flex items-center gap-3">
                <div className="shrink-0">
                  {phase.status === 'done' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : phase.status === 'active' ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : phase.status === 'error' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </div>
                <span className={cn(
                  'text-sm',
                  phase.status === 'done' ? 'text-green-700 dark:text-green-400 font-medium' :
                  phase.status === 'active' ? 'text-blue-700 dark:text-blue-400 font-medium' :
                  phase.status === 'error' ? 'text-red-700 dark:text-red-400' :
                  'text-gray-400 dark:text-gray-500'
                )}>
                  {phase.label}
                </span>
              </div>
            ))}
          </div>

          {/* Resultado */}
          {isComplete && result && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-theme-muted">Creados</span>
                <span className="font-medium text-green-600 dark:text-green-400">{result.created}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-theme-muted">Actualizados</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{result.updated}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-theme-muted">Sin cambios</span>
                <span className="font-medium text-theme-secondary">{result.unchanged}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-theme-muted">Rechazados</span>
                <span className={cn(
                  'font-medium',
                  result.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-theme-secondary'
                )}>{result.failed}</span>
              </div>
              <div className="border-t border-theme-border pt-2 mt-2 flex justify-between text-sm font-semibold">
                <span className="text-theme-primary">Total procesados</span>
                <span className="text-theme-primary">{totalProcessed}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {isError && error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-theme-border flex justify-end gap-2">
          {isError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-primary text-sm"
            >
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={isComplete ? 'btn-primary text-sm' : 'btn-ghost text-sm'}
          >
            {isComplete ? 'Aceptar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}

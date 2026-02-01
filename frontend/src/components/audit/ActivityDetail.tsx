import React, { useMemo } from 'react';
import {
  User,
  Clock,
  Tag,
  Fingerprint,
  MapPin,
  ArrowRight,
  AlertCircle,
  FileText,
  RotateCcw
} from 'lucide-react';
import { formatDateTime, cn } from '@/lib/utils';

interface ActivityDetailProps {
  action: string;
  entityType: string;
  entityId?: string;
  beforeJson?: string | Record<string, unknown> | null;
  afterJson?: string | Record<string, unknown> | null;
  actorName: string;
  createdAt: string;
  centroNombre?: string;
  rolledBackAt?: string | null;
  rolledBackBy?: { id: string; name: string } | null;
}

type SnapshotObject = Record<string, unknown>;

/**
 * Procesa instantáneas JSON de forma segura.
 */
const parseSnapshot = (data: unknown): SnapshotObject => {
  if (!data) return {};
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return { value: data };
    }
    return data as SnapshotObject;
  }
  if (typeof data !== 'string') return {};
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Error parsing snapshot JSON:', e);
    return { _error: 'Datos corruptos o formato inválido' };
  }
};

/**
 * Aplana objetos anidados en una lista plana de rutas (dot notation).
 * Maneja Date objects, arrays y primitivos correctamente.
 */
const flattenObject = (obj: unknown, prefix = ''): SnapshotObject => {
  if (obj === null || obj === undefined) {
    return prefix ? { [prefix]: obj } : {};
  }

  // Primitivos y arrays: guardar directamente
  if (typeof obj !== 'object' || Array.isArray(obj) || obj instanceof Date) {
    return prefix ? { [prefix]: obj } : {};
  }

  const result: SnapshotObject = {};
  const source = obj as SnapshotObject;

  for (const key of Object.keys(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = source[key];

    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      !(val instanceof Date)
    ) {
      // Objeto anidado: recurrir
      Object.assign(result, flattenObject(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }

  return result;
};

/**
 * Formatea valores según su tipo para visualización.
 */
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return `[${value.length} elementos]`;

  // Check if string is ISO date
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    try {
      return formatDateTime(value);
    } catch {
      return value;
    }
  }

  return String(value);
};

export const ActivityDetail: React.FC<ActivityDetailProps> = ({
  action,
  entityType,
  entityId,
  beforeJson,
  afterJson,
  actorName,
  createdAt,
  centroNombre,
  rolledBackAt,
  rolledBackBy
}) => {
  const before = useMemo(() => parseSnapshot(beforeJson), [beforeJson]);
  const after = useMemo(() => parseSnapshot(afterJson), [afterJson]);

  // Clasificación basada en la acción (fuente de verdad principal)
  const isCreate = action.includes('CREATE');
  const isDelete = action.includes('DELETE');
  // UPDATE: explícito en la acción O bien es una acción con before+after que no es CREATE ni DELETE
  const isUpdate = action.includes('UPDATE') || (!isCreate && !isDelete && Boolean(beforeJson && afterJson));

  // Generar motor de diferencias para UPDATE
  const diffs = useMemo(() => {
    if (!isUpdate) return [];

    const flatBefore = flattenObject(before);
    const flatAfter = flattenObject(after);
    const allKeys = Array.from(new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]));

    return allKeys
      .filter(key => {
        // Ignorar campos técnicos de base de datos si es necesario, o mostrar todo
        const ignoredKeys = ['updatedAt', 'lastLoginAt'];
        if (ignoredKeys.includes(key)) return false;

        return JSON.stringify(flatBefore[key]) !== JSON.stringify(flatAfter[key]);
      })
      .map(key => ({
        field: key,
        oldValue: flatBefore[key],
        newValue: flatAfter[key]
      }));
  }, [before, after, isUpdate]);

  // Lista plana para CREATE/DELETE: elegir el snapshot correcto
  const flatData = useMemo(() => {
    // Para DELETE mostramos el estado ANTES (before). Para CREATE, el estado DESPUÉS (after).
    // Fallback: si el snapshot esperado está vacío, intentar con el otro.
    let data: SnapshotObject;
    if (isDelete) {
      data = Object.keys(before).length > 0 ? before : after;
    } else {
      data = Object.keys(after).length > 0 ? after : before;
    }
    const flattened = flattenObject(data);
    return Object.entries(flattened).filter(([key]) => key !== '_error');
  }, [before, after, isDelete]);

  const getActionStyles = () => {
    if (isCreate) return 'bg-green-100 text-green-700 border-green-200';
    if (isDelete) return 'bg-red-100 text-red-700 border-red-200';
    if (isUpdate) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Rollback Badge (High Visibility) */}
      {rolledBackAt && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-pulse-subtle">
          <div className="p-2.5 bg-red-100 rounded-full text-red-600">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-red-700">Cambio Revertido</h4>
              <span className="text-[10px] font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-full uppercase">Audit Trail</span>
            </div>
            <p className="text-xs text-red-600 mt-1 leading-relaxed">
              Esta acción fue deshecha por <span className="font-bold">{rolledBackBy?.name || 'Sistema'}</span> el día <span className="font-medium">{formatDateTime(rolledBackAt)}</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="bg-white/50 px-2 py-1 rounded text-[10px] text-red-800 border border-red-100">
                <span className="opacity-60">Acción Original:</span> {action || '-'}
              </div>
              <div className="bg-white/50 px-2 py-1 rounded text-[10px] text-red-800 border border-red-100">
                <span className="opacity-60">Ref:</span> {entityId || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b", getActionStyles())}>
          {action.replace(/_/g, ' ')}
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <Tag className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gray-400 font-medium">Entidad</p>
              <p className="text-sm font-semibold text-gray-800">{entityType}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <Fingerprint className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gray-400 font-medium">ID de Registro</p>
              <p className="text-sm font-mono text-gray-600 break-all" title={entityId}>
                {entityId || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gray-400 font-medium">Realizado por</p>
              <p className="text-sm font-semibold text-gray-800">{actorName || 'Sistema'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              <Clock className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gray-400 font-medium">Fecha y Hora</p>
              <p className="text-sm font-semibold text-gray-800">{formatDateTime(createdAt)}</p>
            </div>
          </div>

          {centroNombre && (
            <div className="flex items-center gap-3 border-t border-gray-50 pt-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <MapPin className="w-4 h-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 font-medium">Centro / Ubicación</p>
                <p className="text-sm font-semibold text-gray-800">{centroNombre}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparative View for UPDATE */}
      {isUpdate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileText className="w-4 h-4 text-gray-400" />
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-tight">Cambios Realizados</h4>
          </div>

          {diffs.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-100 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Campo</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Antes</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Después</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50 bg-white">
                  {diffs.map((diff, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                          {diff.field}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-red-500 line-through decoration-red-300">
                        {formatValue(diff.oldValue)}
                      </td>
                      <td className="px-4 py-3 text-xs text-green-600 font-semibold bg-green-50/30">
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-green-400" />
                          {formatValue(diff.newValue)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <AlertCircle className="w-6 h-6 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500 font-medium">No se detectaron cambios en los campos</p>
            </div>
          )}
        </div>
      )}

      {/* Grid View for CREATE/DELETE */}
      {(isCreate || isDelete) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileText className="w-4 h-4 text-gray-400" />
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-tight">
              {isCreate ? 'Datos del nuevo registro' : 'Estado previo al borrado'}
            </h4>
          </div>

          {flatData.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
              {flatData.map(([key, value], idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg transition-colors group">
                  <span className="text-[11px] font-medium text-gray-400 group-hover:text-gray-600">{key}</span>
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-md",
                    isCreate ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
                  )}>
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <AlertCircle className="w-6 h-6 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500 font-medium">No hay datos disponibles para mostrar</p>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {Boolean(before._error || after._error) && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700">Error de Procesamiento</p>
            <p className="text-[11px] text-red-600 mt-0.5">
              Algunos datos no pudieron ser procesados correctamente y podrían estar incompletos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

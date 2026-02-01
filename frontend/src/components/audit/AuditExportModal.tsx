import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileDown, Download, Calendar, ClipboardList, RefreshCw, Lock } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { LucideIcon } from 'lucide-react';
import api from '@/config/api';
import type { AuditLog } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/apiError';
import toast from 'react-hot-toast';

const AUDIT_CSV_HEADERS = ['Fecha', 'Acción', 'Usuario', 'Email', 'Tipo Entidad', 'ID Entidad', 'IP', 'Revertido'] as const;

type ExportType = 'all' | 'reversible' | 'irreversible';

function escapeCsv(v: string): string {
  if (v.includes('"') || v.includes(',') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function auditLogToCsvRow(log: AuditLog, headers: string[]): string {
  const data: Record<string, string> = {
    'Fecha': formatDateTime(log.createdAt),
    'Acción': log.action.replace(/_/g, ' '),
    'Usuario': log.user?.name ?? 'Sistema',
    'Email': log.user?.email ?? '',
    'Tipo Entidad': log.entityType ?? '',
    'ID Entidad': log.entityId ?? '',
    'IP': log.ipAddress ?? '',
    'Revertido': log.rolledBackAt ? 'Sí' : 'No',
  };
  return headers.map(h => escapeCsv(data[h] ?? '')).join(',');
}

function buildAuditCsv(logs: AuditLog[], headers: string[]): string {
  const header = headers.join(',');
  const rows = logs.map(log => auditLogToCsvRow(log, headers));
  return [header, ...rows].join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface AuditExportModalProps {
  onClose: () => void;
}

export function AuditExportModal({ onClose }: AuditExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([...AUDIT_CSV_HEADERS]);
  const [isExporting, setIsExporting] = useState(false);

  const { data: usersList } = useQuery({
    queryKey: ['users-list-export'],
    queryFn: () => api.get<{ data: { id: string; name: string; email: string }[] }>('/users', { params: { limit: 100, sortBy: 'name', sortOrder: 'asc' } }).then((r) => r.data.data),
  });

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Selecciona al menos una columna');
      return;
    }

    setIsExporting(true);
    try {
      const allLogs: AuditLog[] = [];
      const limit = 100;

      const targets: Array<'reversible' | 'irreversible'> =
        exportType === 'all' ? ['reversible', 'irreversible'] : [exportType];

      for (const target of targets) {
        let currentPage = 1;
        while (true) {
          const params: Record<string, unknown> = {
            page: currentPage, limit,
            reversible: target === 'reversible' ? 'true' : 'false',
            sortBy: 'createdAt', sortOrder: 'desc',
          };
          if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00.000Z`;
          if (dateTo) params.dateTo = `${dateTo}T23:59:59.999Z`;
          if (selectedUserId) params.userId = selectedUserId;

          const res = await api.get<{ data: AuditLog[]; pagination: { totalPages: number } }>('/audit', { params });
          allLogs.push(...res.data.data);
          if (currentPage >= res.data.pagination.totalPages) break;
          currentPage += 1;
        }
      }

      if (allLogs.length === 0) {
        toast('No hay registros con los filtros seleccionados', { icon: 'ℹ️' });
        return;
      }

      allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const date = new Date().toISOString().slice(0, 10);
      const suffix = exportType === 'all' ? 'completo' : exportType === 'reversible' ? 'acciones' : 'eventos';
      downloadCsv(`auditoria-${suffix}-${date}.csv`, buildAuditCsv(allLogs, selectedColumns));
      toast.success(`CSV exportado (${allLogs.length} registros)`);
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al exportar los datos'));
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions: { value: ExportType; label: string; description: string; icon: LucideIcon; color: string }[] = [
    { value: 'all', label: 'Todo el registro', description: 'Acciones de datos y eventos de seguridad', icon: ClipboardList, color: 'text-gray-600' },
    { value: 'reversible', label: 'Acciones de Datos', description: 'Modificaciones sobre usuarios, turnos y configuraciones', icon: RefreshCw, color: 'text-blue-600' },
    { value: 'irreversible', label: 'Eventos de Seguridad', description: 'Inicios de sesión, cambios de contraseña...', icon: Lock, color: 'text-purple-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-slide-up max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gray-50 flex items-center justify-center">
              <FileDown className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Exportar Auditoría</h2>
              <p className="text-xs text-gray-400">Descarga los registros en formato CSV</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo de registros</p>
            <div className="space-y-2">
              {exportOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = exportType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExportType(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      isSelected ? 'border-gray-700 bg-gray-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-gray-100' : 'bg-gray-50'}`}>
                      <Icon className={`h-4 w-4 ${opt.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? 'text-gray-800' : 'text-gray-600'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400 truncate">{opt.description}</p>
                    </div>
                    <div className={`ml-auto h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${isSelected ? 'border-gray-700 bg-gray-700' : 'border-gray-200'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario (Opcional)</p>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            >
              <option value="">Todos los usuarios</option>
              {usersList?.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />Rango de fechas
              <span className="font-normal text-gray-300 normal-case tracking-normal">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="audit-export-from" className="text-xs text-gray-400 mb-1 block">Desde</label>
                <input id="audit-export-from" type="date" value={dateFrom} max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
              </div>
              <div>
                <label htmlFor="audit-export-to" className="text-xs text-gray-400 mb-1 block">Hasta</label>
                <input id="audit-export-to" type="date" value={dateTo} min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Columnas incluidas (haz clic para alternar)</p>
            <div className="flex flex-wrap gap-1.5">
              {AUDIT_CSV_HEADERS.map((h) => {
                const isSelected = selectedColumns.includes(h);
                return (
                  <button key={h} type="button"
                    onClick={() => setSelectedColumns(prev => prev.includes(h) ? prev.filter(c => c !== h) : [...AUDIT_CSV_HEADERS].filter(c => prev.includes(c) || c === h))}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      isSelected ? 'bg-gray-600 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                    }`}
                  >{h}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
          <button type="button" onClick={handleExport} disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
          >
            {isExporting ? <LoadingSpinner size="sm" /> : <Download className="h-4 w-4" />}
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}

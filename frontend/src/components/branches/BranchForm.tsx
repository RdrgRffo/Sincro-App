import { Save, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface BranchFormData {
  name: string;
  code: string;
  address: string;
  city: string;
  region: string;
  countryCode: string;
  timezone: string;
}

interface BranchFormProps {
  form: BranchFormData;
  isEditing: boolean;
  isSaving: boolean;
  onChange: (form: BranchFormData) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function BranchForm({ form, isEditing, isSaving, onChange, onSave, onCancel }: BranchFormProps) {
  const update = (key: keyof BranchFormData, value: string) => onChange({ ...form, [key]: value });

  return (
    <>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-theme-primary">
          {isEditing ? 'Editar sucursal' : 'Nueva sucursal'}
        </h3>
        <p className="text-xs text-theme-muted">Completa los datos principales. Nombre y código son obligatorios.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Nombre</span>
          <input className="input-field text-sm" placeholder="Nombre" value={form.name}
            onChange={(e) => update('name', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Código</span>
          <input className="input-field text-sm" placeholder="Código (ej: MAD01)" value={form.code}
            onChange={(e) => update('code', e.target.value.toUpperCase())} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Ciudad</span>
          <input className="input-field text-sm" placeholder="Ciudad" value={form.city}
            onChange={(e) => update('city', e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Región</span>
          <input className="input-field text-sm" placeholder="Región" value={form.region}
            onChange={(e) => update('region', e.target.value)} />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-xs font-medium text-theme-muted">Dirección</span>
        <input className="input-field text-sm" placeholder="Dirección" value={form.address}
          onChange={(e) => update('address', e.target.value)} />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">País</span>
          <input className="input-field text-sm" placeholder="País (ES)" value={form.countryCode}
            onChange={(e) => update('countryCode', e.target.value.toUpperCase())} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Zona horaria *</span>
          <select className="input-field text-sm" value={form.timezone}
            onChange={(e) => update('timezone', e.target.value)}>
            <option value="Europe/Madrid">Europe/Madrid (UTC+1/+2)</option>
            <option value="Atlantic/Canary">Atlantic/Canary (UTC+0/+1)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-theme-color/80 pt-3">
        <button type="button" onClick={onSave} disabled={isSaving}
          className="btn-primary text-sm min-w-28 flex items-center justify-center gap-2 disabled:opacity-60">
          {isSaving ? <LoadingSpinner size="sm" className="border-white border-t-white/30" /> : <Save className="h-4 w-4" />}
          {isEditing ? 'Guardar cambios' : 'Crear'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm inline-flex items-center gap-1.5">
          <X className="h-4 w-4" />Cancelar
        </button>
      </div>
    </>
  );
}

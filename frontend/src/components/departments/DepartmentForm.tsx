import { Save, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { Branch } from '@/types';

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  branchIds: string[];
}

interface DepartmentFormProps {
  form: DepartmentFormData;
  branches: Branch[];
  isEditing: boolean;
  isSaving: boolean;
  onChange: (form: DepartmentFormData) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DepartmentForm({ form, branches, isEditing, isSaving, onChange, onSave, onCancel }: DepartmentFormProps) {
  const update = (key: keyof DepartmentFormData, value: string) => onChange({ ...form, [key]: value });
  const toggleBranch = (branchId: string) => {
    const nextBranchIds = form.branchIds.includes(branchId)
      ? form.branchIds.filter((id) => id !== branchId)
      : [...form.branchIds, branchId];
    onChange({ ...form, branchIds: nextBranchIds });
  };

  return (
    <>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-theme-primary">
          {isEditing ? 'Editar departamento' : 'Nuevo departamento'}
        </h3>
        <p className="text-xs text-theme-muted">Completa los datos principales. Nombre y codigo son obligatorios.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Nombre</span>
          <input
            className="input-field text-sm"
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-theme-muted">Codigo</span>
          <input
            className="input-field text-sm"
            placeholder="Codigo (ej: DEP01)"
            value={form.code}
            onChange={(e) => update('code', e.target.value.toUpperCase())}
          />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-xs font-medium text-theme-muted">Descripcion</span>
        <textarea
          className="input-field text-sm min-h-23"
          placeholder="Descripcion breve del departamento"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-theme-muted">Sucursales asociadas</span>
          <span className="text-[11px] text-theme-muted">Selecciona una o más</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 rounded-xl border border-theme-color bg-theme-surface-muted/20 p-3">
          {branches.map((branch) => {
            const checked = form.branchIds.includes(branch.id);
            return (
              <label
                key={branch.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${checked ? 'border-gray-600 bg-gray-50 text-gray-700' : 'border-theme-color bg-theme-surface text-theme-primary'}`}
              >
                <input
                  type="checkbox"
                  className="rounded border-theme-color"
                  checked={checked}
                  onChange={() => toggleBranch(branch.id)}
                />
                <span className="truncate">{branch.name} ({branch.code})</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-theme-color/80">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="btn-primary text-sm min-w-28 flex items-center justify-center gap-2 disabled:opacity-60"
        >
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

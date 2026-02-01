import { useState, type MouseEvent, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Plus, Save, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Skill } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const emptyForm = { name: '', category: '', color: '#1d4ed8', description: '' };

type FormState = typeof emptyForm;

export interface SkillFormModalProps {
  open: boolean;
  onClose: () => void;
  /** `null` = crear nueva skill; con valor = editar esa fila */
  editingSkill: Skill | null;
}

function SkillFormModalBody({ onClose, editingSkill }: { onClose: () => void; editingSkill: Skill | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() =>
    editingSkill
      ? {
          name: editingSkill.name,
          category: editingSkill.category ?? '',
          color: editingSkill.color,
          description: editingSkill.description ?? '',
        }
      : emptyForm,
  );
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const isEdit = Boolean(editingSkill);

  const { data: skillsData } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.get<{ data: Skill[] }>('/skills').then((r) => r.data),
  });

  // Extraer categorías únicas de las skills existentes
  const existingCategories = useMemo(() => {
    const skills = skillsData?.data ?? [];
    const categories = new Set<string>();
    skills.forEach((skill) => {
      if (skill.category && skill.category.trim()) {
        categories.add(skill.category.trim());
      }
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'es'));
  }, [skillsData?.data]);

  // Filtrar categorías que coincidan con el input
  const filteredCategories = useMemo(() => {
    const query = newCategoryInput.toLowerCase().trim();
    if (!query) return existingCategories;
    return existingCategories.filter((cat) => cat.toLowerCase().includes(query));
  }, [existingCategories, newCategoryInput]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        category: form.category || undefined,
        description: form.description || undefined,
      };
      if (editingSkill) {
        return api.patch(`/skills/${editingSkill.id}`, payload);
      }
      return api.post('/skills', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success(isEdit ? 'Skill actualizada' : 'Skill creada');
      onClose();
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo guardar la skill')),
  });

  const handleBackdropMouseDown = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSelectCategory = (category: string) => {
    setForm({ ...form, category });
    setShowCategoryDropdown(false);
    setNewCategoryInput('');
  };

  const handleCreateNewCategory = (e: MouseEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (trimmed) {
      handleSelectCategory(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      role="presentation"
    >
      <div
        className="card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up max-h-[calc(100vh-2rem)] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-form-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-color flex-shrink-0">
          <h2 id="skill-form-modal-title" className="text-lg font-semibold text-theme-primary">
            {isEdit ? 'Editar skill' : 'Nueva skill'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Nombre</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Guardia crítica"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Categoría</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="input-field w-full text-left flex items-center justify-between bg-theme-surface hover:bg-theme-surface-muted"
              >
                <span className={form.category ? 'text-theme-primary' : 'text-theme-muted'}>
                  {form.category || 'Seleccionar o crear...'}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-theme-surface border border-theme-color rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {/* Input para crear nueva categoría */}
                  <div className="p-2 border-b border-theme-color sticky top-0 bg-theme-surface">
                    <input
                      type="text"
                      placeholder="Escribir nueva categoría..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="input-field text-sm w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Botón crear nueva si hay texto */}
                  {newCategoryInput.trim() && !existingCategories.includes(newCategoryInput.trim()) && (
                    <button
                      type="button"
                      onClick={handleCreateNewCategory}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-theme-surface-muted flex items-center gap-2 text-blue-600 font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      Crear: "{newCategoryInput.trim()}"
                    </button>
                  )}

                  {/* Lista de categorías existentes */}
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleSelectCategory(category)}
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-theme-surface-muted transition ${
                          form.category === category ? 'bg-blue-50 text-blue-600 font-medium' : 'text-theme-primary'
                        }`}
                      >
                        {category}
                      </button>
                    ))
                  ) : newCategoryInput.trim() ? null : (
                    <div className="px-3 py-2 text-xs text-theme-muted">Sin categorías disponibles</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Color</label>
            <input
              className="input-field h-10"
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-muted mb-1">Descripción</label>
            <textarea
              className="input-field min-h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-theme-color flex-shrink-0">
          <button type="button" onClick={onClose} className="flex-1 btn-ghost text-sm">
            Cancelar
          </button>
          <button
            type="button"
            className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            disabled={saveMutation.isPending || !form.name.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <LoadingSpinner size="sm" className="border-white border-t-white/30" />
            ) : isEdit ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isEdit ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillFormModal({ open, onClose, editingSkill }: SkillFormModalProps) {
  if (!open) return null;
  return <SkillFormModalBody key={editingSkill?.id ?? 'create'} onClose={onClose} editingSkill={editingSkill} />;
}

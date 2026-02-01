import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/config/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { pageMeta } from '@/config/pageMeta';
import { SkillFormModal } from '@/components/skills/SkillFormModal';
import type { Skill } from '@/types';

export function SkillsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const roleName = user?.role?.name ?? '';
  const canManage = roleName === 'admin';
  const [search, setSearch] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const meta = pageMeta['/admin/skills'];

  const { data, isLoading } = useQuery<{ data: Skill[] }>({
    queryKey: ['skills', 'admin', search],
    queryFn: () =>
      api
        .get('/skills', { params: { includeInactive: true, search: search || undefined } })
        .then((response) => response.data),
  });

  const grouped = useMemo(() => {
    const skills = data?.data ?? [];
    const map = new Map<string, Skill[]>();
    skills.forEach((skill) => {
      const key = skill.category || 'Sin categoría';
      map.set(key, [...(map.get(key) ?? []), skill]);
    });
    return [...map.entries()];
  }, [data?.data]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill desactivada');
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'No se pudo desactivar la skill')),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/skills/${id}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill reactivada');
    },
    onError: (error: unknown) => {
      const msg = getApiErrorMessage(error, 'No se pudo reactivar la skill');
      toast.error(msg);
    },
  });

  const openCreateModal = () => {
    if (!canManage) return;
    setEditingSkill(null);
    setFormModalOpen(true);
  };

  const openEditModal = (skill: Skill) => {
    if (!canManage) return;
    setEditingSkill(skill);
    setFormModalOpen(true);
  };

  const closeFormModal = () => {
    setFormModalOpen(false);
    setEditingSkill(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title={meta.title} subtitle={meta.subtitle} />

      <section className="card p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-theme-primary">Catálogo</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              className="input-field max-w-xs text-sm w-full sm:w-auto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar skill..."
            />
            {canManage ? (
              <button type="button" className="btn-primary text-sm inline-flex items-center justify-center gap-2 shrink-0" onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                Nueva skill
              </button>
            ) : null}
          </div>
        </div>

        {!canManage ? (
          <p className="text-xs text-theme-muted">Solo administradores pueden crear o editar skills.</p>
        ) : null}

        {isLoading ? (
          <div className="py-10 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Sin skills"
            description={canManage ? 'Crea una skill con el botón «Nueva skill» para clasificar capacidades.' : 'No hay skills que coincidan con la búsqueda.'}
            action={
              canManage ? (
                <button type="button" className="btn-primary text-sm inline-flex items-center gap-2" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" />
                  Nueva skill
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {grouped.map(([category, items]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider">{category}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
                  {items.map((skill) => (
                    <div
                      key={skill.id}
                      className="rounded-lg border border-theme-color bg-theme-surface p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: skill.color }} />
                          <span className="font-semibold text-theme-primary truncate">{skill.name}</span>
                        </div>
                        {skill.description ? (
                          <p className="text-xs text-theme-muted mt-1 line-clamp-2">{skill.description}</p>
                        ) : null}
                        {!skill.isActive ? <span className="text-xs text-amber-600 mt-1 inline-block">Inactiva</span> : null}
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg"
                            onClick={() => openEditModal(skill)}
                            title="Editar"
                            aria-label={`Editar ${skill.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {skill.isActive ? (
                            <button
                              type="button"
                              className="p-1.5 text-theme-muted hover:text-red-600 rounded-lg"
                              onClick={() => deleteMutation.mutate(skill.id)}
                              disabled={deleteMutation.isPending}
                              title="Desactivar"
                              aria-label={`Desactivar ${skill.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="p-1.5 text-green-600 hover:text-green-700 rounded-lg"
                              onClick={() => reactivateMutation.mutate(skill.id)}
                              disabled={reactivateMutation.isPending}
                              title="Reactivar"
                              aria-label={`Reactivar ${skill.name}`}
                            >
                              <span className="text-xs font-semibold">Reactivar</span>
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SkillFormModal open={formModalOpen} onClose={closeFormModal} editingSkill={editingSkill} />
    </div>
  );
}

export default SkillsPage;

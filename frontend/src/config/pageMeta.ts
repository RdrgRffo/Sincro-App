export type PageMeta = {
  title: string;
  subtitle?: string;
};

export const pageMeta: Record<string, PageMeta> = {
  '/planning': {
    title: 'Planificación Operativa',
    subtitle: 'Cobertura, sustituciones, equidad, solicitudes de apoyo y preferencias.',
  },
  '/admin/skills': {
    title: 'Skills y certificaciones',
    subtitle: 'Gestiona capacidades reutilizables para cobertura y sustituciones',
  },
};

export function resolvePageMeta(pathname: string): PageMeta | null {
  if (!pathname) return null;
  const exact = pageMeta[pathname];
  if (exact) return exact;

  const match = Object.keys(pageMeta)
    .sort((a, b) => b.length - a.length)
    .find((route) => pathname.startsWith(`${route}/`));

  return match ? pageMeta[match] : null;
}

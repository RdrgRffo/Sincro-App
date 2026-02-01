import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  actionsClassName?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
  titleClassName,
  subtitleClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">{eyebrow}</p>
        )}
        <h1 className={cn('text-2xl font-bold text-theme-primary', titleClassName)}>{title}</h1>
        {subtitle && (
          <p className={cn('text-sm text-theme-muted mt-0.5', subtitleClassName)}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className={cn('flex items-center gap-2 flex-wrap justify-end', actionsClassName)}>
          {actions}
        </div>
      )}
    </div>
  );
}

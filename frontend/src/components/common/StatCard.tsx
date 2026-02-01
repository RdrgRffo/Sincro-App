import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'navy' | 'gold' | 'green' | 'purple';
  className?: string;
}

const colorMap = {
  navy:   { bg: 'bg-gray-800',    light: 'bg-theme-muted',    text: 'text-theme-primary' },
  gold:   { bg: 'bg-gray-700',    light: 'bg-gray-100',    text: 'text-gray-600'  },
  green:  { bg: 'bg-emerald-500', light: 'bg-emerald-50',  text: 'text-emerald-600' },
  purple: { bg: 'bg-gray-600',    light: 'bg-gray-100',    text: 'text-gray-700' },
};

export function StatCard({ title, value, icon: Icon, trend, color = 'navy', className }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn('card p-4 md:p-7 flex items-center gap-3.5 md:gap-5 hover:shadow-md transition-shadow', className)}>
      {/* Icon — smaller on mobile */}
      {Icon ? (
        <div className={cn('p-2.5 md:p-4 rounded-xl flex-shrink-0', c.light)}>
          <Icon className={cn('h-5 w-5 md:h-6 md:w-6', c.text)} />
        </div>
      ) : null}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">
          {title}
        </p>
        <p className="text-xl md:text-2xl font-bold text-gray-800 mt-0.5 md:mt-1">{value}</p>
        {trend && (
          <p className="text-xs text-gray-400 mt-0.5">
            <span
              className={
                trend.value >= 0
                  ? 'text-emerald-600'
                  : 'text-red-500'
              }
            >
              {trend.value >= 0 ? '+' : ''}{trend.value}
            </span>{' '}
            {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
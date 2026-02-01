import { cn } from '@/lib/utils';
import type { ThemeLogoVariant } from '@/types';

interface SincroLogoProps {
  variant?: ThemeLogoVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3.5xl',
  xl: 'text-5xl',
};

const heightMap = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-14',
  xl: 'h-16',
};

function isLightVariant(variant: ThemeLogoVariant): boolean {
  return variant === 'logo_claro';
}

export function SincroLogo({ variant = 'logo_claro', size = 'lg', className }: SincroLogoProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        heightMap[size],
        className,
      )}
    >
      <span
        className={cn(
          'font-bold leading-none lowercase select-none',
          'tracking-[-0.065em]',
          'antialiased',
          sizeMap[size],
          isLightVariant(variant) ? 'text-white' : 'text-slate-900',
        )}
        style={{ fontFamily: "'Wix Madefor Text', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
      >
        sincro
      </span>
    </div>
  );
}

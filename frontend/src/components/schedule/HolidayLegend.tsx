import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BranchHoliday } from '@/types';

const HOLIDAY_TYPE_LABELS: Record<BranchHoliday['type'], string> = {
  nacional: 'Nacional',
  autonomica: 'Autonómica',
  local: 'Local',
  mejora: 'Mejora convenio',
  regional: 'Regional',
  company: 'Empresa',
};

const HOLIDAY_COLORS: Record<BranchHoliday['type'], string> = {
  nacional: '#dc2626',
  autonomica: '#ea580c',
  local: '#d97706',
  mejora: '#65a30d',
  regional: '#0ea5e9',
  company: '#7c3aed',
};

interface HolidayLegendProps {
  holidayTypeCounts: Partial<Record<BranchHoliday['type'], number>>;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function HolidayLegend({ holidayTypeCounts }: HolidayLegendProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="px-5 py-4 border-t border-theme-color">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">Festivos</span>
        <button onClick={() => setExpanded((e) => !e)} className="text-theme-muted hover:text-theme-primary transition-colors">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HOLIDAY_TYPE_LABELS) as BranchHoliday['type'][]).map((type) => {
            const color = HOLIDAY_COLORS[type];
            const count = holidayTypeCounts[type] ?? 0;

            return (
              <span
                key={type}
                title={count > 0 ? `${count} festivo${count > 1 ? 's' : ''}` : 'Sin festivos'}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-150 whitespace-nowrap"
                style={{
                  backgroundColor: color,
                  borderColor: color,
                  color: '#fff',
                  boxShadow: `0 1px 4px rgba(${hexToRgb(color)}, 0.4)`,
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0 flex-none" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }} />
                <span className="leading-none">{HOLIDAY_TYPE_LABELS[type]}</span>
                <span className="rounded-full min-w-5 px-1 text-center text-[10px] font-bold leading-none py-0.5 bg-white/25 text-white">
                  {count}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

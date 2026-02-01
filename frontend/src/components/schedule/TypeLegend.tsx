import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ScheduleType } from '@/types';

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

interface TypeLegendProps {
  scheduleTypes: ScheduleType[];
  hidden: Set<string>;
  onToggle: (v: string) => void;
  counts: Record<string, number>;
}

export function TypeLegend({ scheduleTypes, hidden, onToggle, counts }: TypeLegendProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">Tipos de turno</span>
        <button onClick={() => setExpanded((e) => !e)} className="text-theme-muted hover:text-theme-primary transition-colors">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col items-start gap-2">
          {scheduleTypes.map(({ value, label, color }) => {
            const active = !hidden.has(value);
            const count = counts[value] ?? 0;
            return (
              <button key={value} onClick={() => onToggle(value)}
                title={count > 0 ? `${count} evento${count > 1 ? 's' : ''}` : 'Sin eventos'}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-150 whitespace-nowrap"
                style={active ? {
                  backgroundColor: color, borderColor: color, color: '#fff', boxShadow: `0 1px 4px rgba(${hexToRgb(color)}, 0.4)`,
                } : {
                  backgroundColor: 'transparent', borderColor: '#d0d7de', color: '#5f6368',
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0 flex-none" style={{ backgroundColor: active ? 'rgba(255,255,255,0.6)' : color }} />
                <span className="leading-none">{label}</span>
                <span className="rounded-full min-w-5 px-1 text-center text-[10px] font-bold leading-none py-0.5"
                  style={active ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' } : { backgroundColor: color, color: '#fff' }}
                >{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

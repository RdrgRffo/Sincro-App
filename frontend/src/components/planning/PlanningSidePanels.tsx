import { useState } from 'react';
import { UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import type { CoverageRiskItem } from '@/hooks/usePlanning';

type Props = {
  risks?: CoverageRiskItem[];
  onAssignRisk: (risk: CoverageRiskItem) => void;
};

const INITIAL_VISIBLE = 5;

export function PlanningSidePanels({
  risks = [],
  onAssignRisk,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleRisks = showAll ? risks : risks.slice(0, INITIAL_VISIBLE);
  const hasMore = risks.length > INITIAL_VISIBLE;

  return (
    <aside className="space-y-4">
      <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Riesgos</h2>
          {risks.length > 0 && (
            <span className="text-xs text-slate-400">{risks.length} totales</span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {visibleRisks.map((risk) => (
            <div key={risk.schedule.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{risk.schedule.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{risk.reasons.join(' · ')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onAssignRisk(risk)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <UserPlus className="h-3 w-3" />
                  Asignar
                </button>
              </div>
            </div>
          ))}
          {risks.length === 0 && <p className="text-sm text-slate-400">Sin riesgos en el rango.</p>}

          {/* 3.5: "Ver más" / "Ver menos" button */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Ver más ({risks.length - INITIAL_VISIBLE} restantes)
                </>
              )}
            </button>
          )}
        </div>
      </section>
    </aside>
  );
}

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { CoverageRiskItem } from '@/hooks/usePlanning';

type Props = {
  risks?: CoverageRiskItem[];
  highRiskCount?: number;
};

export function PlanningSummaryCards({
  risks = [],
  highRiskCount = 0,
}: Props) {
  const cards = [
    { label: 'Riesgos altos', value: highRiskCount || risks.filter((risk) => risk.severity === 'high').length, icon: ShieldAlert },
    { label: 'Riesgos totales', value: risks.length, icon: AlertTriangle },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <article key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
            <Icon className="h-5 w-5 text-slate-400" />
          </div>
        </article>
      ))}
    </section>
  );
}

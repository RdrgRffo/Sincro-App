import type { LucideIcon } from 'lucide-react';

export type TabType = 'reversible' | 'irreversible';

interface AuditTab {
  key: TabType;
  label: string;
  icon: LucideIcon;
  count?: number;
  description: string;
}

interface AuditTabsProps {
  tabs: AuditTab[];
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function AuditTabs({ tabs, activeTab, onChange }: AuditTabsProps) {
  return (
    <div className="flex gap-2 border-b border-gray-100">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            id={`audit-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
              isActive
                ? 'border-gray-700 text-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isActive ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { cn } from '@/lib/utils';
import { useState } from 'react';

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterFieldConfig<TFilterKey extends string> = {
  key: TFilterKey;
  type: 'text' | 'select' | 'date';
  label?: string;
  placeholder?: string;
  options?: FilterOption[];
  className?: string;
  id?: string;
  disabled?: boolean;
};

type FilterTableProps<TFilterKey extends string> = {
  fields: Array<FilterFieldConfig<TFilterKey>>;
  values: Record<TFilterKey, string>;
  onChange: (key: TFilterKey, value: string) => void;
  className?: string;
};

export function FilterTable<TFilterKey extends string>({
  fields,
  values,
  onChange,
  className,
}: FilterTableProps<TFilterKey>) {
  const [showDateFilters, setShowDateFilters] = useState(false);

  const nonDateFields = fields.filter((f) => f.type !== 'date');
  const dateFields = fields.filter((f) => f.type === 'date');

  const renderField = (field: FilterFieldConfig<TFilterKey>) => {
    if (field.type === 'text') {
      return (
        <div
          key={field.key}
          className={cn(field.className ?? 'min-w-44')}
        >
          {field.label && (
            <label
              htmlFor={field.id ?? String(field.key)}
              className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1"
            >
              {field.label}
            </label>
          )}
          <input
            id={field.id ?? String(field.key)}
            type="text"
            placeholder={field.placeholder}
            value={values[field.key] ?? ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={field.disabled}
            className="input-field text-sm"
          />
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.key} className={cn(field.className ?? 'w-40')}>
          {field.label && (
            <label
              htmlFor={field.id ?? String(field.key)}
              className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1"
            >
              {field.label}
            </label>
          )}
          <select
            id={field.id ?? String(field.key)}
            value={values[field.key] ?? ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={field.disabled}
            className="input-field text-sm w-full"
          >
            {(field.options ?? []).map((option) => (
              <option key={`${field.key}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // type === 'date'
    return (
      <div key={field.key} className={cn(field.className ?? 'w-36')}>
        {field.label && (
          <label
            htmlFor={field.id ?? String(field.key)}
            className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1"
          >
            {field.label}
          </label>
        )}
        <input
          id={field.id ?? String(field.key)}
          type="date"
          value={values[field.key] ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={field.disabled}
          className="input-field text-sm w-full"
        />
      </div>
    );
  };

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {/* Non-date fields in exact order */}
      {nonDateFields.map(renderField)}

      {/* Toggle button for date filters */}
      {dateFields.length > 0 && (
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setShowDateFilters((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
          >
            <span className="font-mono text-xs">{showDateFilters ? '-' : '+'}</span>
            <span>{showDateFilters ? 'Ocultar filtros de fecha' : 'más filtros'}</span>
          </button>
        </div>
      )}

      {/* Date filters (hidden by default) */}
      {showDateFilters && dateFields.map(renderField)}
    </div>
  );
}

export const HOLIDAY_TYPES = ['nacional', 'autonomica', 'local', 'mejora', 'regional', 'company'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const HOLIDAY_SCOPES = ['national', 'regional', 'local', 'company'] as const;
export type HolidayScope = (typeof HOLIDAY_SCOPES)[number];

export const BRANCH_CODES = {
  TFN: 'TFN',
  GC: 'GC',
} as const;


import { createAppError } from '../../../common/errors/error-catalog';
import { BranchHolidayInput, BranchHolidayScope, BranchHolidayType } from './branches.types';

export function deriveHolidayScope(type: BranchHolidayType): BranchHolidayScope {
  if (type === 'nacional') return 'national';
  if (type === 'regional') return 'regional';
  if (type === 'company') return 'company';
  return 'local';
}

export function normalizeBranchCode(code: string) {
  return code.trim().toUpperCase();
}

export function normalizeHolidayDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function resolveHolidayScope(data: Partial<BranchHolidayInput>) {
  return data.scope ?? (data.type ? deriveHolidayScope(data.type) : undefined);
}

export function ensureDateRange(from?: string, to?: string) {
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw createAppError('BAD_REQUEST', 'Parámetro from inválido');
  }
  if (toDate && Number.isNaN(toDate.getTime())) {
    throw createAppError('BAD_REQUEST', 'Parámetro to inválido');
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw createAppError('BAD_REQUEST', 'El rango de fechas es inválido');
  }

  if (fromDate) fromDate.setHours(0, 0, 0, 0);
  if (toDate) toDate.setHours(23, 59, 59, 999);

  return { fromDate, toDate };
}

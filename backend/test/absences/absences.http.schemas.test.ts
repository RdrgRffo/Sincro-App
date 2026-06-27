/**
 * @file absences.http.schemas.test.ts
 * Tests de validación Zod para los schemas HTTP de ausencias.
 */

import {
  createAbsenceRequestSchema,
  approveAbsenceSchema,
  rejectAbsenceSchema,
  absenceIdParamsSchema,
  listAbsencesQuerySchema,
  absenceCalendarQuerySchema,
} from '../../src/modules/absences/absences.http.schemas';

describe('absences.http.schemas', () => {
  describe('createAbsenceRequestSchema', () => {
    // 2026-07-01 = miercoles, 2026-07-03 = viernes (ambos laborables)
    it('accepts valid absence request', () => {
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-03T00:00:00.000Z',
        type: 'vacaciones',
        note: 'Ausencia',
      });
      expect(result.success).toBe(true);
    });

    it('rejects weekend start date', () => {
      // 2026-07-04 = sabado
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-04T00:00:00.000Z',
        endDate: '2026-07-06T00:00:00.000Z',
        type: 'vacaciones',
      });
      expect(result.success).toBe(false);
    });

    it('rejects end date before start date', () => {
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-03T00:00:00.000Z',
        endDate: '2026-07-01T00:00:00.000Z',
        type: 'vacaciones',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when type is missing', () => {
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-03T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('accepts explicit absence type', () => {
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-03T00:00:00.000Z',
        type: 'asuntos_propios',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('asuntos_propios');
      }
    });

    it('accepts optional employeeId for manager proxy creation', () => {
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-03T00:00:00.000Z',
        type: 'vacaciones',
        employeeId: 'clq1234567890abcdefghijk',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employeeId).toBe('clq1234567890abcdefghijk');
      }
    });

    it('rejects empty employeeId when provided', () => {
      const result = createAbsenceRequestSchema.safeParse({
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-03T00:00:00.000Z',
        type: 'vacaciones',
        employeeId: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('approveAbsenceSchema', () => {
    it('accepts with note', () => {
      const result = approveAbsenceSchema.safeParse({ note: 'Aprobado' });
      expect(result.success).toBe(true);
    });

    it('accepts without note', () => {
      const result = approveAbsenceSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('rejectAbsenceSchema', () => {
    it('accepts with rejection reason', () => {
      const result = rejectAbsenceSchema.safeParse({ rejectionReason: 'No disponible' });
      expect(result.success).toBe(true);
    });

    it('rejects empty rejection reason', () => {
      const result = rejectAbsenceSchema.safeParse({ rejectionReason: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing rejection reason', () => {
      const result = rejectAbsenceSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('absenceIdParamsSchema', () => {
    it('accepts valid id', () => {
      const result = absenceIdParamsSchema.safeParse({ id: 'abs-1' });
      expect(result.success).toBe(true);
    });

    it('rejects empty id', () => {
      const result = absenceIdParamsSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('listAbsencesQuerySchema', () => {
    it('accepts empty query (defaults)', () => {
      const result = listAbsencesQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('accepts valid filters', () => {
      const result = listAbsencesQuerySchema.safeParse({
        status: 'pending',
        branchId: 'b-1',
        search: 'maria',
        page: '2',
        pageSize: '10',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('absenceCalendarQuerySchema', () => {
    it('accepts valid year and week', () => {
      const result = absenceCalendarQuerySchema.safeParse({ year: '2026', week: '27' });
      expect(result.success).toBe(true);
    });

    it('accepts only year (week is optional)', () => {
      const result = absenceCalendarQuerySchema.safeParse({ year: '2026' });
      expect(result.success).toBe(true);
    });

    it('accepts from/to range', () => {
      const result = absenceCalendarQuerySchema.safeParse({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.999Z',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (all params optional)', () => {
      const result = absenceCalendarQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

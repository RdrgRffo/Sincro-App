import { describe, it, expect } from 'vitest';
import {
  buildScheduleChunks,
  buildChunkRange,
  buildDateRange,
  getPresetDurationHours,
  normalizeDate,
  toIsoDate,
  parseTimeToMinutes,
  buildDateTime,
} from '@/components/schedule/shiftScheduling';

const preset = { id: 'morning', label: 'Turno manana', startTime: '08:00', endTime: '16:00' };
const nightPreset = { id: 'night', label: 'Turno noche', startTime: '22:00', endTime: '06:00' };
const eveningPreset = { id: 'evening', label: 'Turno tarde', startTime: '16:00', endTime: '23:00' };

const day = (value: string) => normalizeDate(new Date(value));

describe('shiftScheduling helpers', () => {
  describe('normalizeDate', () => {
    it('returns a date at midnight UTC', () => {
      const date = normalizeDate(new Date('2026-05-05'));
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
      expect(date.getUTCMilliseconds()).toBe(0);
    });

    it('preserves the correct date regardless of timezone', () => {
      const date = normalizeDate(new Date('2026-05-05'));
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(4); // May = 4 (0-indexed)
      expect(date.getUTCDate()).toBe(5);
    });
  });

  describe('toIsoDate', () => {
    it('formats a date as YYYY-MM-DD', () => {
      const date = normalizeDate(new Date('2026-05-05'));
      expect(toIsoDate(date)).toBe('2026-05-05');
    });
  });

  describe('parseTimeToMinutes', () => {
    it('converts HH:mm to minutes', () => {
      expect(parseTimeToMinutes('08:00')).toBe(480);
      expect(parseTimeToMinutes('16:30')).toBe(990);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('buildDateTime', () => {
    it('combines a date with a time string', () => {
      const date = normalizeDate(new Date('2026-05-05'));
      const dt = buildDateTime(date, '08:30');
      expect(dt.getUTCFullYear()).toBe(2026);
      expect(dt.getUTCMonth()).toBe(4);
      expect(dt.getUTCDate()).toBe(5);
      expect(dt.getUTCHours()).toBe(8);
      expect(dt.getUTCMinutes()).toBe(30);
    });
  });

  describe('buildDateRange', () => {
    it('returns all dates between start and end inclusive', () => {
      const start = day('2026-05-05');
      const end = day('2026-05-07');
      const range = buildDateRange(start, end);
      expect(range).toHaveLength(3);
      expect(toIsoDate(range[0])).toBe('2026-05-05');
      expect(toIsoDate(range[1])).toBe('2026-05-06');
      expect(toIsoDate(range[2])).toBe('2026-05-07');
    });

    it('returns a single date when start equals end', () => {
      const range = buildDateRange(day('2026-05-05'), day('2026-05-05'));
      expect(range).toHaveLength(1);
      expect(toIsoDate(range[0])).toBe('2026-05-05');
    });
  });

  describe('getPresetDurationHours', () => {
    it('computes 8 hours for a morning shift', () => {
      expect(getPresetDurationHours(preset)).toBe(8);
    });

    it('computes 8 hours for an overnight shift', () => {
      expect(getPresetDurationHours(nightPreset)).toBe(8);
    });

    it('computes 7 hours for an evening shift', () => {
      expect(getPresetDurationHours(eveningPreset)).toBe(7);
    });

    it('handles a 24-hour shift', () => {
      const fullDay = { id: 'full', label: 'Full', startTime: '00:00', endTime: '00:00' };
      expect(getPresetDurationHours(fullDay)).toBe(24);
    });
  });

  describe('buildScheduleChunks', () => {
    it('groups consecutive days with the same preset', () => {
      const dates = [day('2026-05-05'), day('2026-05-06'), day('2026-05-08')];
      const overrides = { '2026-05-08': 'evening' };

      const chunks = buildScheduleChunks(dates, overrides, 'morning');

      expect(chunks).toHaveLength(2);
      expect(toIsoDate(chunks[0].startDate)).toBe('2026-05-05');
      expect(toIsoDate(chunks[0].endDate)).toBe('2026-05-06');
      expect(toIsoDate(chunks[1].startDate)).toBe('2026-05-08');
    });

    it('handles a single date', () => {
      const dates = [day('2026-05-05')];
      const chunks = buildScheduleChunks(dates, {}, 'morning');

      expect(chunks).toHaveLength(1);
      expect(toIsoDate(chunks[0].startDate)).toBe('2026-05-05');
      expect(toIsoDate(chunks[0].endDate)).toBe('2026-05-05');
      expect(chunks[0].presetId).toBe('morning');
    });

    it('handles empty dates array', () => {
      const chunks = buildScheduleChunks([], {}, 'morning');
      expect(chunks).toHaveLength(0);
    });

    it('creates separate chunks for non-consecutive dates with same preset', () => {
      const dates = [day('2026-05-05'), day('2026-05-08')];
      const chunks = buildScheduleChunks(dates, {}, 'morning');

      expect(chunks).toHaveLength(2);
      expect(toIsoDate(chunks[0].startDate)).toBe('2026-05-05');
      expect(toIsoDate(chunks[1].startDate)).toBe('2026-05-08');
    });

    it('creates separate chunks for consecutive dates with different presets', () => {
      const dates = [day('2026-05-05'), day('2026-05-06')];
      const overrides = { '2026-05-06': 'evening' };
      const chunks = buildScheduleChunks(dates, overrides, 'morning');

      expect(chunks).toHaveLength(2);
      expect(chunks[0].presetId).toBe('morning');
      expect(chunks[1].presetId).toBe('evening');
    });

    it('uses default preset when no override exists', () => {
      const dates = [day('2026-05-05')];
      const chunks = buildScheduleChunks(dates, {}, 'night');

      expect(chunks[0].presetId).toBe('night');
    });

    it('sorts unsorted input dates', () => {
      const dates = [day('2026-05-08'), day('2026-05-05'), day('2026-05-06')];
      const chunks = buildScheduleChunks(dates, {}, 'morning');

      expect(chunks).toHaveLength(2);
      expect(toIsoDate(chunks[0].startDate)).toBe('2026-05-05');
      expect(toIsoDate(chunks[0].endDate)).toBe('2026-05-06');
      expect(toIsoDate(chunks[1].startDate)).toBe('2026-05-08');
    });

    it('handles a long consecutive range', () => {
      const dates = [
        day('2026-05-04'), day('2026-05-05'), day('2026-05-06'),
        day('2026-05-07'), day('2026-05-08'), day('2026-05-09'),
        day('2026-05-10'),
      ];
      const chunks = buildScheduleChunks(dates, {}, 'morning');

      expect(chunks).toHaveLength(1);
      expect(toIsoDate(chunks[0].startDate)).toBe('2026-05-04');
      expect(toIsoDate(chunks[0].endDate)).toBe('2026-05-10');
    });
  });

  describe('buildChunkRange', () => {
    it('builds date range for a chunk with morning preset', () => {
      const chunk = { startDate: day('2026-05-05'), endDate: day('2026-05-06'), presetId: 'morning' };
      const range = buildChunkRange(chunk, preset);

      expect(range.start.getUTCHours()).toBe(8);
      expect(range.start.getUTCMinutes()).toBe(0);
      expect(range.end.getUTCHours()).toBe(16);
      expect(range.end.getUTCMinutes()).toBe(0);
      expect(range.hoursPerDay).toBe(8);
    });

    it('handles overnight preset by adding a day to end', () => {
      const chunk = { startDate: day('2026-05-05'), endDate: day('2026-05-06'), presetId: 'night' };
      const range = buildChunkRange(chunk, nightPreset);

      expect(range.start.getUTCHours()).toBe(22);
      expect(range.start.getUTCMinutes()).toBe(0);
      // Overnight: end time (06:00) is before start time (22:00), so +1 day
      expect(range.end.getUTCHours()).toBe(6);
      expect(range.end.getUTCMinutes()).toBe(0);
      expect(range.hoursPerDay).toBe(8);
    });

    it('handles a single-day chunk', () => {
      const chunk = { startDate: day('2026-05-05'), endDate: day('2026-05-05'), presetId: 'morning' };
      const range = buildChunkRange(chunk, preset);

      expect(range.start.getUTCHours()).toBe(8);
      expect(range.start.getUTCMinutes()).toBe(0);
      expect(range.end.getUTCHours()).toBe(16);
      expect(range.end.getUTCMinutes()).toBe(0);
    });
  });
});

/**
 * @file app-error.test.ts
 * Tests unitarios para AppError e isAppError.
 */

import { AppError, isAppError } from '../../src/common/errors/app-error';

describe('AppError', () => {
  describe('constructor', () => {
    it('creates error with code, statusCode, message', () => {
      const err = new AppError('NOT_FOUND', 404, 'Resource not found');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AppError');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Resource not found');
    });

    it('creates error with details', () => {
      const err = new AppError('BAD_REQUEST', 400, 'Invalid input', { field: 'email' });
      expect(err.details).toEqual({ field: 'email' });
    });

    it('creates error without details', () => {
      const err = new AppError('INTERNAL_ERROR', 500, 'Server error');
      expect(err.details).toBeUndefined();
    });

    it('supports all error codes', () => {
      const codes: Array<[string, number]> = [
        ['BAD_REQUEST', 400],
        ['UNAUTHORIZED', 401],
        ['FORBIDDEN', 403],
        ['NOT_FOUND', 404],
        ['CONFLICT', 409],
        ['UNPROCESSABLE_ENTITY', 422],
        ['INTERNAL_ERROR', 500],
      ];

      for (const [code, status] of codes) {
        const err = new AppError(code as any, status, 'test');
        expect(err.code).toBe(code);
        expect(err.statusCode).toBe(status);
      }
    });
  });

  describe('isAppError', () => {
    it('returns true for AppError instances', () => {
      const err = new AppError('NOT_FOUND', 404, 'test');
      expect(isAppError(err)).toBe(true);
    });

    it('returns false for regular Error', () => {
      expect(isAppError(new Error('regular'))).toBe(false);
    });

    it('returns false for TypeError', () => {
      expect(isAppError(new TypeError('type'))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isAppError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isAppError(undefined)).toBe(false);
    });

    it('returns false for plain objects', () => {
      expect(isAppError({ code: 'NOT_FOUND' })).toBe(false);
    });

    it('returns false for strings', () => {
      expect(isAppError('error')).toBe(false);
    });
  });
});

/**
 * @file middleware.test.ts
 * Tests unitarios para los middlewares: auth, permission, errorHandler, validation.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../src/middleware/auth.middleware';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockJson = jest.fn().mockReturnThis();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockRes = (): Partial<Response> => ({
  status: mockStatus as unknown as Response['status'],
  json: mockJson,
}) as unknown as Response;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── AppError ────────────────────────────────────────────────────────────────

describe('AppError', () => {
  const { AppError, isAppError } = require('../../src/common/errors/app-error');

  it('creates an error with correct properties', () => {
    const err = new AppError('NOT_FOUND', 404, 'User not found', { id: '123' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('User not found');
    expect(err.details).toEqual({ id: '123' });
  });

  it('isAppError returns true for AppError instances', () => {
    const err = new AppError('BAD_REQUEST', 400, 'Invalid');
    expect(isAppError(err)).toBe(true);
  });

  it('isAppError returns false for regular errors', () => {
    expect(isAppError(new Error('regular'))).toBe(false);
  });

  it('isAppError returns false for non-error values', () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError({})).toBe(false);
  });
});

// ─── authMiddleware ──────────────────────────────────────────────────────────

describe('authMiddleware', () => {
  const { authMiddleware } = require('../../src/middleware/auth.middleware');

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 401 when no authorization header', async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    // Mock jwt to throw
    jest.doMock('jsonwebtoken', () => ({
      verify: jest.fn(() => { throw new Error('jwt malformed'); }),
    }));

    // Re-import after mocking
    const { authMiddleware: authMid } = require('../../src/middleware/auth.middleware');

    const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    await authMid(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requirePermission ───────────────────────────────────────────────────────

describe('requirePermission', () => {
  const { requirePermission } = require('../../src/middleware/permission.middleware');

  it('returns 401 when req.user is undefined', () => {
    const req = {} as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    const middleware = requirePermission('users:view');
    middleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is locked', () => {
    const req = { user: { status: 'locked', permissions: ['users:view'] } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    const middleware = requirePermission('users:view');
    middleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is disabled', () => {
    const req = { user: { status: 'disabled', permissions: ['users:view'] } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    const middleware = requirePermission('users:view');
    middleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user lacks required permission', () => {
    const req = { user: { status: 'active', permissions: ['absences:read'] } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    const middleware = requirePermission('users:view');
    middleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user has required permission', () => {
    const req = { user: { status: 'active', permissions: ['users:view', 'users:create'] } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    const middleware = requirePermission('users:view');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('calls next when user has all required permissions', () => {
    const req = { user: { status: 'active', permissions: ['users:view', 'users:create'] } } as AuthRequest;
    const res = mockRes();
    const next = jest.fn();

    const middleware = requirePermission('users:view', 'users:create');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ─── errorHandler ────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  const { errorHandler } = require('../../src/middleware/errorHandler.middleware');
  const { AppError } = require('../../src/common/errors/app-error');
  const { z } = require('zod');

  it('handles AppError', () => {
    const err = new AppError('NOT_FOUND', 404, 'User not found');
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('handles ZodError', () => {
    const schema = z.object({ name: z.string().min(1) });
    let zodErr: any;
    try { schema.parse({ name: '' }); } catch (e) { zodErr = e; }

    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(zodErr, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('handles Prisma P2000 error', () => {
    const err = { code: 'P2000', meta: { target: 'name' }, message: 'Value too long' };
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('handles Prisma P2002 error (unique constraint)', () => {
    const err = { code: 'P2002', meta: { target: 'email' } };
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(409);
  });

  it('handles Prisma P2025 error (not found)', () => {
    const err = { code: 'P2025' };
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(404);
  });

  it('handles unknown errors with 500', () => {
    const err = new Error('Something went wrong');
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(500);
  });

  it('handles webhook_url overflow in P2000', () => {
    const err = { code: 'P2000', meta: { target: 'webhook_url' }, message: 'Data too long' };
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(400);
  });
});

// ─── validateRequest ─────────────────────────────────────────────────────────

describe('validateRequest', () => {
  const { validateRequest } = require('../../src/middleware/validation.middleware');
  const { z } = require('zod');

  it('passes valid body through', async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateRequest({ body: schema });

    const req = { body: { name: 'test' }, query: {}, params: {} } as any;
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'test' });
  });

  it('rejects invalid body with 400', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const middleware = validateRequest({ body: schema });

    const req = { body: { name: '' }, query: {}, params: {} } as any;
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes valid query through', async () => {
    const schema = z.object({ page: z.coerce.number() });
    const middleware = validateRequest({ query: schema });

    const req = { body: {}, query: { page: '1' }, params: {} } as any;
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes valid params through', async () => {
    const schema = z.object({ id: z.string() });
    const middleware = validateRequest({ params: schema });

    const req = { body: {}, query: {}, params: { id: 'user-1' } } as any;
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next with error for non-Zod errors', async () => {
    const schema = {
      parseAsync: jest.fn().mockRejectedValue(new Error('DB error')),
    };
    const middleware = validateRequest({ body: schema as any });

    const req = { body: {}, query: {}, params: {} } as any;
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

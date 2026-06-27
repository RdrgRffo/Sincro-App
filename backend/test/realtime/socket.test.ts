/**
 * @file socket.test.ts
 * Tests unitarios para el módulo de WebSocket / eventos en tiempo real.
 */

import { Server as HttpServer } from 'http';
import { REALTIME_EVENTS } from '../../src/realtime/events';

// Mock completo del logger
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Realtime Events', () => {
  describe('REALTIME_EVENTS', () => {
    it('defines all expected event names', () => {
      expect(REALTIME_EVENTS.SCHEDULE_CREATED).toBe('schedule.created');
      expect(REALTIME_EVENTS.SCHEDULE_UPDATED).toBe('schedule.updated');
      expect(REALTIME_EVENTS.SCHEDULE_DELETED).toBe('schedule.deleted');
      expect(REALTIME_EVENTS.USER_CREATED).toBe('user.created');
      expect(REALTIME_EVENTS.USER_UPDATED).toBe('user.updated');
      expect(REALTIME_EVENTS.USER_STATUS_CHANGED).toBe('user.statusChanged');
      expect(REALTIME_EVENTS.USER_ROLE_CHANGED).toBe('user.roleChanged');
      expect(REALTIME_EVENTS.USER_DELETED).toBe('user.deleted');
      expect(REALTIME_EVENTS.AUDIT_CREATED).toBe('audit.created');
      expect(REALTIME_EVENTS.NOTIFICATION_CHANGED).toBe('notification.changed');
    });
  });
});

describe('initializeSocketServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('initializes socket server with http server', () => {
    const { initializeSocketServer } = require('../../src/realtime/socket');
    const httpServer = new HttpServer();
    const io = initializeSocketServer(httpServer);
    expect(io).toBeDefined();
    expect(typeof io.on).toBe('function');
    httpServer.close();
  });

  it('publishRealtimeEvent does not throw when not initialized', () => {
    const { publishRealtimeEvent } = require('../../src/realtime/socket');
    expect(() => {
      publishRealtimeEvent('schedule.created', {
        entity: 'schedule',
        action: 'created',
        id: 'sch-1',
        changedAt: new Date().toISOString(),
        actorId: 'user-1',
      });
    }).not.toThrow();
  });

  it('publishRealtimeEvent works after initialization', () => {
    const { initializeSocketServer, publishRealtimeEvent } = require('../../src/realtime/socket');
    const httpServer = new HttpServer();
    initializeSocketServer(httpServer);

    expect(() => {
      publishRealtimeEvent('schedule.created', {
        entity: 'schedule',
        action: 'created',
        id: 'sch-1',
        changedAt: new Date().toISOString(),
        actorId: 'user-1',
      });
    }).not.toThrow();

    httpServer.close();
  });
});

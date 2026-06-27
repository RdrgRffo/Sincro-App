/**
 * @file shift-presets.service.test.ts
 * Tests del servicio de presets de turnos: CRUD con transacciones y audit.
 */

jest.mock('../../src/config/database', () => {
  const shiftPreset = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return {
    prisma: {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $on: jest.fn(),
      $use: jest.fn(),
      $transaction: jest.fn(),
      $extends: jest.fn(),
      shiftPreset,
    },
  };
});

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => {
    const tx = {
      shiftPreset: {
        create: jest.fn((args: any) => Promise.resolve({ id: 'preset-1', ...args.data })),
        findUnique: jest.fn((args: any) => {
          if (args.where.id === 'preset-1') {
            return Promise.resolve({ id: 'preset-1', name: 'Turno Mañana', startTime: '08:00', endTime: '16:00' });
          }
          if (args.where.id === 'inactive-1') {
            return Promise.resolve({ id: 'inactive-1', name: 'Turno Tarde', startTime: '14:00', endTime: '22:00', isActive: false });
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn((args: any) => {
          if (args.where.name === 'Turno Tarde' && args.where.isActive === true) {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        delete: jest.fn((args: any) => Promise.resolve({ id: args.where.id })),
      },
    };
    return fn(tx);
  }),
}));

import { prisma } from '../../src/config/database';
import {
  listShiftPresets,
  getShiftPresetById,
  createShiftPreset,
  updateShiftPreset,
  deleteShiftPreset,
  reactivateShiftPreset,
} from '../../src/modules/shift-presets/shift-presets.service';

const mockModel = prisma.shiftPreset as unknown as {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('shift-presets.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listShiftPresets', () => {
    it('retorna todos los presets ordenados por nombre', async () => {
      const mockPresets = [
        { id: 'p1', name: 'Turno Mañana', startTime: '08:00', endTime: '16:00' },
        { id: 'p2', name: 'Turno Noche', startTime: '22:00', endTime: '06:00' },
      ];
      mockModel.findMany.mockResolvedValue(mockPresets);

      const result = await listShiftPresets();

      expect(mockModel.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } });
      expect(result).toEqual(mockPresets);
    });
  });

  describe('getShiftPresetById', () => {
    it('retorna un preset por ID', async () => {
      const mockPreset = { id: 'p1', name: 'Turno Mañana', startTime: '08:00', endTime: '16:00' };
      mockModel.findUnique.mockResolvedValue(mockPreset);

      const result = await getShiftPresetById('p1');

      expect(mockModel.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(result).toEqual(mockPreset);
    });

    it('lanza error si no existe', async () => {
      mockModel.findUnique.mockResolvedValue(null);

      await expect(getShiftPresetById('p-invalid')).rejects.toThrow('Shift preset no encontrado');
    });
  });

  describe('createShiftPreset', () => {
    it('crea un nuevo preset con audit', async () => {
      const input = { name: 'Turno Tarde', startTime: '14:00', endTime: '22:00', isActive: true };

      const result = await createShiftPreset(input, 'actor-1');

      expect(result.id).toBe('preset-1');
      expect(result.name).toBe('Turno Tarde');
    });
  });

  describe('updateShiftPreset', () => {
    it('actualiza un preset existente', async () => {
      const result = await updateShiftPreset('preset-1', { name: 'Turno Mañana Plus' }, 'actor-1');

      expect(result.name).toBe('Turno Mañana Plus');
    });
  });

  describe('deleteShiftPreset', () => {
    it('elimina un preset existente', async () => {
      // Mock findUnique to return a preset (called outside transaction)
      mockModel.findUnique.mockResolvedValue({ id: 'preset-1', name: 'Turno Mañana', startTime: '08:00', endTime: '16:00' });

      const result = await deleteShiftPreset('preset-1', 'actor-1');
      expect(result.isActive).toBe(false);
    });
  });

  describe('reactivateShiftPreset', () => {
    it('reactiva un preset inactivo', async () => {
      const result = await reactivateShiftPreset('inactive-1', { id: 'actor-1', ipAddress: '127.0.0.1' });

      expect(result.isActive).toBe(true);
    });

    it('lanza error si no existe', async () => {
      await expect(reactivateShiftPreset('missing-1', { id: 'actor-1', ipAddress: '127.0.0.1' })).rejects.toThrow('Shift preset no encontrado');
    });
  });
});

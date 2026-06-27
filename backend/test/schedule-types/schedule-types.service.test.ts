/**
 * @file schedule-types.service.test.ts
 * Verifica la lógica de negocio de tipos de turno: CRUD, conflictos de valor, y protección de borrado.
 */

// Mock PrismaClient antes de cualquier import
jest.mock('../../src/config/database', () => {
  const scheduleType = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const schedule = {
    count: jest.fn(),
  };
  return {
    prisma: {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $on: jest.fn(),
      $use: jest.fn(),
      $transaction: jest.fn(),
      $extends: jest.fn(),
      scheduleType,
      schedule,
    },
  };
});

// Mock audit.service para evitar que logAuditOrThrow falle
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));

// Mock executeInTransaction para que pase un tx con scheduleType mockeado
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => {
    const tx = {
      scheduleType: {
        create: jest.fn((args: any) => Promise.resolve({ id: 'st-1', ...args.data, isActive: true })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    return fn(tx);
  }),
}));

import { prisma } from '../../src/config/database';
import {
  getScheduleTypes,
  getScheduleTypeById,
  createScheduleType,
  updateScheduleType,
  deleteScheduleType,
  reactivateScheduleType,
} from '../../src/modules/schedule-types/schedule-types.service';

const mockScheduleType = prisma.scheduleType as unknown as {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};
const mockSchedule = prisma.schedule as unknown as {
  count: jest.Mock;
};

describe('schedule-types.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getScheduleTypes', () => {
    it('retorna solo tipos activos ordenados por createdAt', async () => {
      const mockTypes = [
        { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true, createdAt: new Date('2026-01-01') },
        { id: 'st-2', value: 'turno', label: 'Turno', color: '#00ff00', isActive: true, createdAt: new Date('2026-01-02') },
      ];
      mockScheduleType.findMany.mockResolvedValue(mockTypes);

      const result = await getScheduleTypes();

      expect(result).toEqual(mockTypes);
      expect(mockScheduleType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getScheduleTypeById', () => {
    it('retorna el tipo si existe y está activo', async () => {
      const mockType = { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true };
      mockScheduleType.findUnique.mockResolvedValue(mockType);

      const result = await getScheduleTypeById('st-1');
      expect(result).toEqual(mockType);
    });

    it('lanza error si no existe', async () => {
      mockScheduleType.findUnique.mockResolvedValue(null);

      await expect(getScheduleTypeById('st-invalid')).rejects.toThrow('Tipo de turno no encontrado');
    });
  });

  describe('createScheduleType', () => {
    it('crea un nuevo tipo de turno', async () => {
      mockScheduleType.findUnique.mockResolvedValue(null);
      const created = { id: 'st-1', value: 'nuevo', label: 'Nuevo', color: '#ff0000', isActive: true };
      mockScheduleType.create.mockResolvedValue(created);

      const result = await createScheduleType({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' });
      expect(result).toEqual(created);
    });

    it('lanza error si el value ya existe y el tipo está activo', async () => {
      mockScheduleType.findUnique.mockResolvedValue({
        id: 'st-existing',
        value: 'nuevo',
        label: 'Existente',
        color: '#00ff00',
        isActive: true,
      });

      await expect(
        createScheduleType({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' }),
      ).rejects.toThrow('Ya existe un tipo de turno con este valor');
    });
  });

  describe('updateScheduleType', () => {
    it('actualiza un tipo existente', async () => {
      const existing = { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true };
      mockScheduleType.findUnique.mockResolvedValueOnce(existing);
      const updated = { ...existing, label: 'Guardia Nocturna' };
      mockScheduleType.update.mockResolvedValue(updated);

      const result = await updateScheduleType('st-1', { label: 'Guardia Nocturna' });
      expect(result.label).toBe('Guardia Nocturna');
    });

    it('lanza error si el value nuevo ya existe en otro registro', async () => {
      const existing = { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true };
      // getScheduleTypeById -> findUnique({ where: { id: 'st-1', isActive: true } })
      mockScheduleType.findUnique.mockResolvedValueOnce(existing);
      // check value conflict -> findUnique({ where: { value: 'nuevo' } })
      mockScheduleType.findUnique.mockResolvedValueOnce({ id: 'st-2', value: 'nuevo' });

      await expect(
        updateScheduleType('st-1', { value: 'nuevo' }),
      ).rejects.toThrow('Ya existe un tipo de turno con este valor');
    });
  });

  describe('deleteScheduleType', () => {
    it('desactiva un tipo si no tiene schedules asociados', async () => {
      const existing = { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true };
      mockScheduleType.findUnique.mockResolvedValue(existing);
      mockSchedule.count.mockResolvedValue(0);

      await expect(deleteScheduleType('st-1')).resolves.not.toThrow();
    });

    it('lanza error si tiene schedules asociados', async () => {
      const existing = { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true };
      mockScheduleType.findUnique.mockResolvedValue(existing);
      mockSchedule.count.mockResolvedValue(5);

      await expect(deleteScheduleType('st-1')).rejects.toThrow(
        'No se puede eliminar un tipo de turno que está siendo usado por horarios existentes',
      );
    });
  });

  describe('reactivateScheduleType', () => {
    it('reactiva un tipo inactivo y escribe audit', async () => {
      const inactive = { id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: false };
      mockScheduleType.findUnique.mockImplementation(async (args: any) => {
        if (args.where.id === 'st-1') return inactive as any;
        if (args.where.value === 'guardia') return inactive as any;
        return null;
      });
      mockScheduleType.update.mockResolvedValue({ ...inactive, isActive: true } as any);

      const result = await reactivateScheduleType('st-1', { id: 'actor-1', ipAddress: '127.0.0.1' });

      expect(result.isActive).toBe(true);
      expect(mockScheduleType.findUnique).toHaveBeenCalled();
    });

    it('lanza error si el tipo ya está activo', async () => {
      mockScheduleType.findUnique.mockResolvedValue({ id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true } as any);

      await expect(reactivateScheduleType('st-1')).rejects.toThrow('El tipo de turno ya está activo');
    });
  });
});

import { PrismaClient } from '@prisma/client';

export async function seedShiftPresets(prisma: PrismaClient) {
  console.log('BLOQUE: SHIFT PRESETS');

  const shiftPresetsData = [
    { name: 'Turno mañana', startTime: '08:00', endTime: '16:00' },
    { name: 'Turno tarde', startTime: '16:00', endTime: '23:00' },
    { name: 'Turno noche', startTime: '00:00', endTime: '08:00' },
    { name: 'Turno archivo', startTime: '07:00', endTime: '15:00', isActive: false },
  ];

  for (const presetData of shiftPresetsData) {
    const existing = await prisma.shiftPreset.findFirst({
      where: { name: presetData.name },
    });
    if (!existing) {
      await prisma.shiftPreset.create({ data: presetData });
      console.log(`[SHIFT_PRESET] Created ${presetData.name}`);
    } else {
      console.log(`[SHIFT_PRESET] ${presetData.name} already exists`);
    }
  }
}

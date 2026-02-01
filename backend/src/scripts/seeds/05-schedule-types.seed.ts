import { PrismaClient } from '@prisma/client';

export async function seedScheduleTypes(prisma: PrismaClient) {
  console.log('BLOQUE: SCHEDULE TYPES');

  const scheduleTypesData = [
    { value: 'guardia', label: 'Guardia', color: '#2563eb' },
    { value: 'ausencia', label: 'Ausencia', color: '#64748b' },
    { value: 'formacion', label: 'Formación', color: '#0e7490' },
    { value: 'otro', label: 'Otro', color: '#4b5563' },
    { value: 'excepcion', label: 'Excepción', color: '#dc2626' },
    { value: 'cerrado_temporal', label: 'Cerrado temporal', color: '#94a3b8', isActive: false },
  ];

  const scheduleTypesByValue = new Map<string, string>();
  for (const typeData of scheduleTypesData) {
    const synced = await prisma.scheduleType.upsert({
      where: { value: typeData.value },
      create: typeData,
      update: typeData,
    });
    scheduleTypesByValue.set(typeData.value, synced.id);
    console.log(`[SCHEDULE_TYPE] Synced ${typeData.label}`);
  }

  return scheduleTypesByValue;
}

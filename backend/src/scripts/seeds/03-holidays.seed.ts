import { PrismaClient, Branch } from '@prisma/client';

export async function seedHolidays(
  prisma: PrismaClient,
  branches: Branch[]
) {
  console.log('BLOQUE: FERIADOS');

  const holidays_2026 = [
    // Festivos Nacionales
    { date: new Date(2026, 0, 1), name: 'Año Nuevo', type: 'nacional', scope: 'national', targetRegion: 'all' },
    { date: new Date(2026, 0, 6), name: 'Reyes Magos', type: 'nacional', scope: 'national', targetRegion: 'all' },
    { date: new Date(2026, 3, 3), name: 'Viernes Santo', type: 'nacional', scope: 'national', targetRegion: 'all' },
    { date: new Date(2026, 4, 1), name: 'Día del Trabajo', type: 'nacional', scope: 'national', targetRegion: 'all' },
    { date: new Date(2026, 9, 12), name: 'Fiesta Nacional de España', type: 'nacional', scope: 'national', targetRegion: 'all' },
    { date: new Date(2026, 11, 8), name: 'Inmaculada Concepción', type: 'nacional', scope: 'national', targetRegion: 'all' },
    { date: new Date(2026, 11, 25), name: 'Navidad', type: 'nacional', scope: 'national', targetRegion: 'all' },
    // Festivos Autonómicos – Canarias
    { date: new Date(2026, 3, 2), name: 'Jueves Santo', type: 'autonomica', scope: 'regional', targetRegion: 'Canarias' },
    { date: new Date(2026, 10, 2), name: 'Todos los Santos (sustitución)', type: 'autonomica', scope: 'regional', targetRegion: 'Canarias' },
    // Mejoras de Convenio
    { date: new Date(2026, 11, 24), name: 'Nochebuena (Mejora Convenio)', type: 'mejora', scope: 'company', targetRegion: 'all' },
    { date: new Date(2026, 11, 31), name: 'Nochevieja (Mejora Convenio)', type: 'mejora', scope: 'company', targetRegion: 'all' },
    // Locales TENERIFE
    { date: new Date(2026, 1, 2), name: 'Virgen de Candelaria', type: 'local', scope: 'local', targetRegion: 'Tenerife' },
    { date: new Date(2026, 1, 17), name: 'Martes de Carnaval', type: 'local', scope: 'local', targetRegion: 'Tenerife' },
    // Locales GRAN CANARIA
    { date: new Date(2026, 1, 17), name: 'Martes de Carnaval', type: 'local', scope: 'local', targetRegion: 'Gran Canaria' },
    { date: new Date(2026, 5, 24), name: 'Día de San Juan', type: 'local', scope: 'local', targetRegion: 'Gran Canaria' },
    { date: new Date(2026, 8, 8), name: 'Patrona de Gran Canaria', type: 'local', scope: 'local', targetRegion: 'Gran Canaria' },
  ];

  const partial_days_2026 = [
    { date: new Date(2026, 0, 5), name: 'Víspera de Reyes (tarde libre)', targetRegion: 'all' },
    { date: new Date(2026, 5, 23), name: 'Víspera de San Juan (tarde libre)', targetRegion: 'Gran Canaria' },
  ];

  const allBranches = branches.filter((b): b is NonNullable<typeof b> => b !== null);

  let holidayCount = 0;
  let partialCount = 0;

  for (const h of holidays_2026) {
    for (const b of allBranches) {
      const isApplicable = h.targetRegion === 'all' ||
        h.targetRegion === 'Canarias' ||
        b.region === h.targetRegion;

      if (isApplicable) {
        await prisma.branchHoliday.upsert({
          where: {
            branchId_date_name: {
              branchId: b.id,
              date: h.date,
              name: h.name,
            },
          },
          update: {
            type: h.type as any,
            scope: h.scope,
            isPartial: false,
          },
          create: {
            name: h.name,
            date: h.date,
            type: h.type as any,
            scope: h.scope,
            branchId: b.id,
            isPartial: false,
          } as any,
        });
        holidayCount++;
      }
    }
  }

  for (const p of partial_days_2026) {
    for (const b of allBranches) {
      const isApplicable = p.targetRegion === 'all' || b.region === p.targetRegion;

      if (isApplicable) {
        await prisma.branchHoliday.upsert({
          where: {
            branchId_date_name: {
              branchId: b.id,
              date: p.date,
              name: p.name,
            },
          },
          update: {
            type: 'mejora',
            scope: 'company',
            isPartial: true,
          },
          create: {
            name: p.name,
            date: p.date,
            type: 'mejora',
            scope: 'company',
            branchId: b.id,
            isPartial: true,
          } as any,
        });
        partialCount++;
      }
    }
  }

  console.log(`[HOLIDAY] ${holidayCount} holidays and ${partialCount} partial days seeded.`);
}

import { PrismaClient } from '@prisma/client';
import { ensureSeedDepartment } from './utils';

// Departamentos que siempre deben existir en la BD
const SEED_DEPARTMENTS = [
  { key: 'seguridad', name: 'Seguridad', code: 'SEG' },
  { key: 'mantenimiento', name: 'Mantenimiento', code: 'MANT' },
  { key: 'operaciones', name: 'Operaciones', code: 'OPER' },
  { key: 'administracion', name: 'Administración', code: 'ADMIN' },
  { key: 'sistemas', name: 'Sistemas', code: 'SIST' },
  { key: 'rrhh', name: 'Recursos Humanos', code: 'RRHH' },
  { key: 'calidad', name: 'Calidad', code: 'CAL' },
  { key: 'logistica', name: 'Logística', code: 'LOG' },
] as const;

export async function seedBranchesAndDepartments(prisma: PrismaClient) {
  console.log('BLOQUE: BRANCHES Y DEPARTAMENTOS');

  let mainBranch = await prisma.branch.findUnique({ where: { code: 'TFN' } });
  let secondBranch = await prisma.branch.findUnique({ where: { code: 'GC' } });
  let archivedBranch = await prisma.branch.findUnique({ where: { code: 'ARCH' } });

  if (!mainBranch) {
    mainBranch = await prisma.branch.create({
      data: {
        name: 'Sede Tenerife Norte',
        code: 'TFN',
        city: 'Santa Cruz de Tenerife',
        region: 'Tenerife',
        countryCode: 'ES',
        timezone: 'Atlantic/Canary',
        isActive: true,
      },
    });
    console.log('[BRANCH] Created Sede Tenerife Norte (TFN)');
  }

  if (!secondBranch) {
    secondBranch = await prisma.branch.create({
      data: {
        name: 'Sede Gran Canaria',
        code: 'GC',
        city: 'Las Palmas de Gran Canaria',
        region: 'Gran Canaria',
        countryCode: 'ES',
        timezone: 'Atlantic/Canary',
        isActive: true,
      },
    });
    console.log('[BRANCH] Created Sede Gran Canaria (GC)');
  }

  if (!archivedBranch) {
    archivedBranch = await prisma.branch.create({
      data: {
        name: 'Sede Archivo',
        code: 'ARCH',
        city: 'Archivo',
        region: 'Histórica',
        countryCode: 'ES',
        timezone: 'Europe/Madrid',
        isActive: false,
      },
    });
    console.log('[BRANCH] Created Sede Archivo (ARCH, inactive)');
  }

  const allBranchIds = [mainBranch.id, secondBranch.id];
  const departments = await Promise.all(
    SEED_DEPARTMENTS.map((dept) => ensureSeedDepartment(prisma, dept.name, dept.code, allBranchIds)),
  );

  await ensureSeedDepartment(prisma, 'Archivo', 'ARCHD', [archivedBranch.id], false);

  const departmentsByCode = new Map(SEED_DEPARTMENTS.map((dept, index) => [dept.key, departments[index].id]));

  console.log(`[DEPARTMENT] ${departments.length} departments ensured`);

  return { mainBranch, secondBranch, archivedBranch, departmentsByCode };
}

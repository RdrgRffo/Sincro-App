import { PrismaClient } from '@prisma/client';
import { ensureSeedUser } from './utils';

export async function seedUsers(
  prisma: PrismaClient,
  dbRoles: Record<string, string>,
  departmentsByCode: Map<string, string>,
  mainBranchId: string,
  secondBranchId: string
) {
  console.log('BLOQUE: USUARIOS');

  const adminUser = await ensureSeedUser(
    prisma,
    {
      name: 'Administrador Sistema',
      email: 'admin@sincro.local',
      password: 'AdminPass123!',
      roleId: dbRoles['admin'],
      status: 'active',
      companyPhone: '900200200',
      auxiliaryPhone: '600200200',
      branchId: mainBranchId,
      departmentId: departmentsByCode.get('administracion'),
    },
      'Admin neutral'
  );

  const managerUser = await ensureSeedUser(
    prisma,
    {
      name: 'María García',
      email: 'manager@sincro.local',
      password: 'Manager123!',
      roleId: dbRoles['general_manager'],
      status: 'active',
      companyPhone: '900200200',
      auxiliaryPhone: '600200200',
      branchId: mainBranchId,
      forcePasswordChange: false,
      departmentId: departmentsByCode.get('operaciones'),
    },
      'Manager neutral'
  );

  const gmSecondUser = await ensureSeedUser(
    prisma,
    {
      name: 'Roberto Díaz',
      email: 'gm.gc@sincro.local',
      password: 'Manager123!',
      roleId: dbRoles['general_manager'],
      status: 'active',
      companyPhone: '900300300',
      auxiliaryPhone: '600300300',
      branchId: secondBranchId,
      forcePasswordChange: false,
      departmentId: departmentsByCode.get('operaciones'),
    },
      'GM Gran Canaria neutral'
  );

  const inactiveUser = await ensureSeedUser(
    prisma,
    {
      name: 'Usuario Archivo',
      email: 'inactive.archived@sincro.local',
      password: 'User123!',
      roleId: dbRoles['employee'],
      status: 'disabled',
      isActive: false,
      companyPhone: '900999999',
      auxiliaryPhone: '600999999',
      branchId: mainBranchId,
      forcePasswordChange: false,
      departmentId: departmentsByCode.get('calidad'),
    },
    'Inactive archive user',
  );

  type DepartmentKey = 'seguridad' | 'mantenimiento' | 'operaciones' | 'administracion' | 'sistemas' | 'rrhh' | 'calidad' | 'logistica';
  const demoUsers: Array<{ name: string; email: string; departmentKey: DepartmentKey; branchId: string; role?: string }> = [
    // TFN employees
    { name: 'Nuria Vega',      email: 'nuria@company.local', departmentKey: 'seguridad',      branchId: mainBranchId },
    { name: 'Andrés Gil',      email: 'andres@company.local', departmentKey: 'seguridad',      branchId: mainBranchId },
    { name: 'Elena Ruiz',      email: 'elena@company.local', departmentKey: 'mantenimiento',  branchId: mainBranchId },
    { name: 'Mario León',      email: 'mario@company.local', departmentKey: 'mantenimiento',    branchId: mainBranchId },
    // GC employees
    { name: 'Raúl Medina',     email: 'raul@company.local',  departmentKey: 'mantenimiento',  branchId: secondBranchId, role: 'department_manager' },
    { name: 'Claudia Pérez',   email: 'claudia@company.local', departmentKey: 'seguridad',    branchId: secondBranchId },
    { name: 'Iván Ortega',     email: 'ivan@company.local',  departmentKey: 'administracion', branchId: secondBranchId },
    { name: 'Marta Acosta',    email: 'marta@company.local', departmentKey: 'seguridad',      branchId: secondBranchId },
  ];

  const createdUsers: Array<{ id: string; email: string; branchId: string | null; departmentId: string | null }> = [];
  for (const u of demoUsers) {
    const user = await ensureSeedUser(
      prisma,
      {
        name: u.name,
        email: u.email,
        branchId: u.branchId,
        password: 'User123!',
        roleId: u.role ? dbRoles[u.role] : dbRoles['employee'],
        status: 'active',
        forcePasswordChange: true,
        departmentId: departmentsByCode.get(u.departmentKey),
      },
        'Neutral demo user'
    );
    if (user) createdUsers.push(user);
  }

  console.log(`[USER] ${createdUsers.length + 4} users ensured (admin + 2 GMs + 1 inactive + ${createdUsers.length} employees)`);

  return { adminUser, managerUser, gmSecondUser, inactiveUser, createdUsers };
}

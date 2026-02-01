/**
 * Seed Runner - Executes all modular seeds in order
 * Usage: npx ts-node src/scripts/seeds.run.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { databaseHasAnyData } from './seeds/utils';
import { seedBranchesAndDepartments } from './seeds/02-branches.seed';
import { seedHolidays } from './seeds/03-holidays.seed';
import { seedRolesAndPermissions } from './seeds/04-roles-permissions.seed';
import { seedScheduleTypes } from './seeds/05-schedule-types.seed';
import { seedShiftPresets } from './seeds/06-shift-presets.seed';
import { seedSkills } from './seeds/07-skills.seed';
import { seedUsers } from './seeds/08-users.seed';
import { seedUserSkills } from './seeds/09-user-skills.seed';
import { seedAbsences } from './seeds/10-absences.seed';
import { seedSchedules } from './seeds/11-schedules.seed';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const prisma = new PrismaClient();

async function main() {
  console.log('═'.repeat(80));
  console.log('SINCRO - DATABASE SEEDING');
  console.log('═'.repeat(80));
  console.log();

  // Check if data already exists
  const alreadySeeded = await databaseHasAnyData(prisma);
  if (alreadySeeded) {
    console.log(' Base de datos ya contiene datos. Saltando seed principal.');
    console.log('   Sincronizando permisos...');
    
    // Always sync permissions
    await seedRolesAndPermissions(prisma);
    console.log(' Permisos sincronizados correctamente.');
    return;
  }

  console.log(' Iniciando seeding modular...\n');

  try {
    // 1. Branches & Departments
    const { mainBranch, secondBranch, departmentsByCode } = await seedBranchesAndDepartments(prisma);
    console.log(' Sucursales y departamentos OK\n');

    // 2. Holidays
    await seedHolidays(prisma, [mainBranch, secondBranch]);
    console.log(' Feriados OK\n');

    // 3. Roles & Permissions
    const dbRoles = await seedRolesAndPermissions(prisma);
    console.log(' Roles y permisos OK\n');

    // 4. Schedule Types
    const scheduleTypesByValue = await seedScheduleTypes(prisma);
    console.log(' Tipos de turnos OK\n');

    // 5. Shift Presets
    await seedShiftPresets(prisma);
    console.log(' Presets de turnos OK\n');

    // 6. Skills
    const createdSkills = await seedSkills(prisma);
    console.log(' Habilidades OK\n');

    // 7. Users
    const { adminUser, managerUser, gmSecondUser, createdUsers } = await seedUsers(
      prisma,
      dbRoles,
      departmentsByCode,
      mainBranch.id,
      secondBranch.id
    );
    console.log(' Usuarios OK\n');

    // 8. User Skills
    const allUsers = [adminUser, managerUser, gmSecondUser, ...createdUsers];
    await seedUserSkills(prisma, allUsers as any, createdSkills);
    console.log(' Habilidades de usuarios OK\n');

    // 9. Absences
    await seedAbsences(
      prisma,
      adminUser,
      mainBranch.id,
      secondBranch.id,
      createdUsers
    );
    console.log(' Ausencias OK\n');

    // 10. Schedules
    await seedSchedules(
      prisma,
      adminUser,
      managerUser,
      scheduleTypesByValue,
      mainBranch.id,
      secondBranch.id,
      createdUsers
    );
    console.log(' Guardias y eventos OK\n');

    // Summary
    console.log('═'.repeat(80));
    console.log(' SEED COMPLETADO EXITOSAMENTE');
    console.log('═'.repeat(80));
    console.log();
    console.log(' CREDENCIALES DE ACCESO:');
    console.log('   Admin (TFN):        admin@sincro.local / AdminPass123!');
    console.log('   GM TFN:             manager@sincro.local / Manager123!');
    console.log('   GM GC:              gm.gc@sincro.local / Manager123!');
    console.log('   Dept. Manager GC:   raul@company.local / User123!');
    console.log('   Employee TFN:       nuria@company.local / User123! (cambio obligatorio)');
    console.log('   Employee TFN:       andres@company.local / User123! (cambio obligatorio)');
    console.log('   Employee TFN:       elena@company.local / User123! (cambio obligatorio)');
    console.log('   Employee TFN:       mario@company.local / User123! (cambio obligatorio)');
    console.log('   Employee GC:        claudia@company.local / User123! (cambio obligatorio)');
    console.log('   Employee GC:        ivan@company.local / User123! (cambio obligatorio)');
    console.log('   Employee GC:        marta@company.local / User123! (cambio obligatorio)');
    console.log();
    console.log('═'.repeat(80));
  } catch (error) {
    console.error(' ERROR DURANTE SEED:');
    console.error(error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Export for Prisma seed.ts to import
export { main };

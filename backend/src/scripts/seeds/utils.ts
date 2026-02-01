import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function databaseHasAnyData(prisma: PrismaClient): Promise<boolean> {
  const userCount = await prisma.user.count();
  return userCount > 0;
}

/**
 * Reserva el siguiente employeeId global (USR-XXXX).
 * Copia la lógica de reserveNextEmployeeId de users.repository pero sin TransactionClient,
 * usando el PrismaClient directamente.
 */
async function reserveNextEmployeeId(prisma: PrismaClient): Promise<string> {
  const sequenceId = 'global';

  await prisma.employeeIdSequence.upsert({
    where: { id: sequenceId },
    create: { id: sequenceId, lastNumber: 0 },
    update: {},
  });

  await prisma.$executeRaw`
    SELECT id
    FROM employee_id_sequences
    WHERE id = ${sequenceId}
    FOR UPDATE
  `;

  const [row] = await prisma.$queryRaw<Array<{ maxNumber: number | bigint | null }>>`
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, 5) AS UNSIGNED)), 0) AS maxNumber
    FROM users
    WHERE employee_id LIKE 'USR-%'
  `;

  const sequence = await prisma.employeeIdSequence.findUnique({ where: { id: sequenceId } });
  const currentNumber = Math.max(sequence?.lastNumber ?? 0, Number(row?.maxNumber ?? 0));
  const nextNumber = currentNumber + 1;

  await prisma.employeeIdSequence.update({
    where: { id: sequenceId },
    data: { lastNumber: nextNumber },
  });

  return `USR-${String(nextNumber).padStart(4, '0')}`;
}

export async function ensureSeedUser(
  prisma: PrismaClient,
  input: any,
  label: string
) {
  try {
    const { password, ...userData } = input;
    const isActive = userData.isActive ?? true;
    const passwordHash = await bcrypt.hash(password || 'User123!', 10);

    // Generar employeeId automáticamente si no se proporciona
    if (!userData.employeeId) {
      userData.employeeId = await reserveNextEmployeeId(prisma);
    }

    const user = await prisma.user.upsert({
      where: { email_isActive: { email: userData.email, isActive } },
      update: userData,
      create: {
        ...userData,
        passwordHash,
        derivedUsername: userData.email.split('@')[0],
      },
    });
    console.log(`[USER] ${label} synced: ${userData.email} (employeeId: ${user.employeeId})`);
    return user;
  } catch (error) {
    console.error(`[ERROR] Failed to sync user ${label} (${input.email}):`, error);
    throw error;
  }
}

export async function ensureSeedSchedule(
  prisma: PrismaClient,
  adminId: string,
  userId: string,
  branchId: string,
  title: string,
  scheduleTypeId: string,
  color: string,
  isLastMinute: boolean,
  startAt: Date,
  endAt: Date,
  departmentId?: string | null
) {
  const existing = await prisma.schedule.findFirst({
    where: { title, createdById: adminId, startDatetime: startAt, endDatetime: endAt }
  });

  if (existing) {
    const existingAssignment = await prisma.scheduleAssignment.findUnique({
      where: {
        scheduleId_userId: {
          scheduleId: existing.id,
          userId,
        },
      },
    });

    if (existing.branchId !== branchId || !existingAssignment || existing.departmentId !== departmentId) {
      const repaired = await prisma.schedule.update({
        where: { id: existing.id },
        data: {
          ...(existing.branchId !== branchId ? { branchId } : {}),
          ...(existing.departmentId !== departmentId ? { departmentId } : {}),
          ...(!existingAssignment ? { assignments: { create: { userId } } } : {}),
        },
      });
      console.log(`[SCHEDULE] Schedule repaired: ${title}`);
      return repaired;
    }

    console.log(`[SCHEDULE] Schedule already exists: ${title}`);
    return existing;
  }

  const schedule = await prisma.schedule.create({
    data: {
      title,
      scheduleTypeId,
      color,
      isLastMinute,
      startDatetime: startAt,
      endDatetime: endAt,
      hoursPerDay: 8,
      createdById: adminId,
      branchId,
      ...(departmentId ? { departmentId } : {}),
      assignments: {
        create: { userId }
      }
    }
  });
  console.log(`[SCHEDULE] Created schedule: ${title} for user ID ${userId}`);
  return schedule;
}

export async function ensureSeedDepartment(
  prisma: PrismaClient,
  name: string,
  code: string,
  branchIds: string[],
  isActive = true
) {
  const existing = await prisma.department.findUnique({ where: { code } });

  const department = existing ?? await prisma.department.create({
    data: {
      name,
      code,
      isActive,
    },
  });

  if (existing && existing.name !== name) {
    await prisma.department.update({
      where: { id: existing.id },
      data: { name, isActive },
    });
  }

  if (existing && existing.isActive !== isActive) {
    await prisma.department.update({
      where: { id: existing.id },
      data: { isActive },
    });
  }

  await prisma.departmentBranch.createMany({
    data: branchIds.map((branchId) => ({ departmentId: department.id, branchId })),
    skipDuplicates: true,
  });

  return department;
}

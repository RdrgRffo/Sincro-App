import { PrismaClient, AbsenceType, User } from '@prisma/client';
import { addDays } from 'date-fns';

export async function seedAbsences(
  prisma: PrismaClient,
  adminUser: User,
  mainBranchId: string,
  secondBranchId: string,
  createdUsers: Array<{ id: string; email: string; branchId: string | null; departmentId: string | null }>
) {
  console.log('BLOQUE: ABSENCES');

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1); // Start of week (Monday)

  const nuriaInfo = createdUsers.find(u => u.email === 'nuria@company.local');
  const andresInfo = createdUsers.find(u => u.email === 'andres@company.local');
  const raulInfo = createdUsers.find(u => u.email === 'raul@company.local');
  const claudiaInfo = createdUsers.find(u => u.email === 'claudia@company.local');
  const elenaInfo = createdUsers.find(u => u.email === 'elena@company.local');
  const marioInfo = createdUsers.find(u => u.email === 'mario@company.local');
  const ivanInfo = createdUsers.find(u => u.email === 'ivan@company.local');
  const martaInfo = createdUsers.find(u => u.email === 'marta@company.local');

  async function ensureAbsence(data: {
    employeeId: string;
    type: AbsenceType;
    status: 'pending' | 'colindante' | 'approved' | 'rejected' | 'cancelled';
    startDate: Date;
    endDate: Date;
    note?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
    rejectionReason?: string;
    branchId: string;
    departmentId: string | null;
  }) {
    const existing = await prisma.absence.findFirst({
      where: { employeeId: data.employeeId, startDate: data.startDate },
    });
    if (existing) {
      console.log(`[ABSENCE] Request already exists for ${data.employeeId} on ${data.startDate}`);
      return existing;
    }
    if (!data.departmentId) {
      throw new Error(`Missing departmentId for absence seed: ${data.employeeId}`);
    }
    const created = await prisma.absence.create({
      data: {
        employeeId: data.employeeId,
        type: data.type,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        note: data.note,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
        rejectionReason: data.rejectionReason,
        branchId: data.branchId,
        departmentId: data.departmentId,
      },
    });
    console.log(`[ABSENCE] Created ${data.status} request for ${data.employeeId}`);
    return created;
  }

  let count = 0;

  // Nuria: approved absence (this week)
  if (nuriaInfo) {
    await ensureAbsence({
      employeeId: nuriaInfo.id,
      type: AbsenceType.vacaciones,
      status: 'approved',
      startDate: monday,
      endDate: addDays(monday, 4),
      note: 'Ausencia familiar (aprobada)',
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      branchId: mainBranchId,
      departmentId: nuriaInfo.departmentId,
    });
    count++;
  }

  // Andrés: pending formation (next week)
  if (andresInfo) {
    await ensureAbsence({
      employeeId: andresInfo.id,
      type: AbsenceType.formacion,
      status: 'pending',
      startDate: addDays(monday, 7),
      endDate: addDays(monday, 11),
      note: 'Curso de formación obligatoria (pendiente de aprobación)',
      branchId: mainBranchId,
      departmentId: andresInfo.departmentId,
    });
    count++;
  }

  // Raúl: rejected absence
  if (raulInfo) {
    await ensureAbsence({
      employeeId: raulInfo.id,
      type: AbsenceType.asuntos_propios,
      status: 'rejected',
      startDate: addDays(monday, 1),
      endDate: addDays(monday, 2),
      note: 'Necesito cubrir unos asuntos personales',
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      rejectionReason: 'No hay cobertura suficiente esa semana en mantenimiento',
      branchId: secondBranchId,
      departmentId: raulInfo.departmentId,
    });
    count++;
  }

  // Claudia: approved compensatory
  if (claudiaInfo) {
    await ensureAbsence({
      employeeId: claudiaInfo.id,
      type: AbsenceType.compensatorio,
      status: 'approved',
      startDate: addDays(monday, 3),
      endDate: addDays(monday, 4),
      note: 'Compensatorio por horas acumuladas (aprobado)',
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      branchId: secondBranchId,
      departmentId: claudiaInfo.departmentId,
    });
    count++;
  }

  // Elena
  if (elenaInfo) {
    await ensureAbsence({
      employeeId: elenaInfo.id,
      type: AbsenceType.permiso_retribuido,
      status: 'pending',
      startDate: addDays(monday, 14),
      endDate: addDays(monday, 18),
      note: 'Permiso retribuido — semana de verano',
      branchId: mainBranchId,
      departmentId: elenaInfo.departmentId,
    });
    count++;
  }

  // Mario
  if (marioInfo) {
    await ensureAbsence({
      employeeId: marioInfo.id,
      type: AbsenceType.cumpleanos,
      status: 'approved',
      startDate: addDays(monday, 7),
      endDate: addDays(monday, 9),
      note: 'Día de cumpleaños (convenio)',
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      branchId: mainBranchId,
      departmentId: marioInfo.departmentId,
    });
    count++;
  }

  // Iván
  if (ivanInfo) {
    await ensureAbsence({
      employeeId: ivanInfo.id,
      type: AbsenceType.festivo,
      status: 'cancelled',
      startDate: addDays(monday, 3),
      endDate: addDays(monday, 3),
      note: 'Festivo local — solicitud cancelada por el empleado',
      branchId: secondBranchId,
      departmentId: ivanInfo.departmentId,
    });
    count++;
  }

  // Marta
  if (martaInfo) {
    await ensureAbsence({
      employeeId: martaInfo.id,
      type: AbsenceType.maternidad,
      status: 'pending',
      startDate: addDays(monday, 21),
      endDate: addDays(monday, 25),
      note: 'Licencia de maternidad (bloque demo)',
      branchId: secondBranchId,
      departmentId: martaInfo.departmentId,
    });
    count++;
  }

  // Extra: Paternidad y baja médica
  if (nuriaInfo) {
    await ensureAbsence({
      employeeId: nuriaInfo.id,
      type: AbsenceType.paternidad,
      status: 'pending',
      startDate: addDays(monday, 35),
      endDate: addDays(monday, 35),
      note: 'Permiso de paternidad (solicitud demo)',
      branchId: mainBranchId,
      departmentId: nuriaInfo.departmentId,
    });
    count++;
  }

  if (andresInfo) {
    await ensureAbsence({
      employeeId: andresInfo.id,
      type: AbsenceType.baja_medica,
      status: 'pending',
      startDate: addDays(monday, 42),
      endDate: addDays(monday, 43),
      note: 'Baja médica temporal (justificante en RRHH)',
      branchId: mainBranchId,
      departmentId: andresInfo.departmentId,
    });
    count++;
  }

  console.log(`[ABSENCE] ${count} absence records created`);
}

import { PrismaClient, User } from '@prisma/client';
import { addDays, setHours, setMinutes, startOfWeek } from 'date-fns';
import { ensureSeedSchedule } from './utils';

export async function seedSchedules(
  prisma: PrismaClient,
  adminUser: User,
  managerUser: User,
  scheduleTypesByValue: Map<string, string>,
  mainBranchId: string,
  secondBranchId: string,
  createdUsers: Array<{ id: string; email: string; branchId: string | null; departmentId: string | null }>
) {
  console.log('BLOQUE: SCHEDULES');

  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const nuriaInfo = createdUsers.find(u => u.email === 'nuria@company.local');
  const andresInfo = createdUsers.find(u => u.email === 'andres@company.local');
  const elenaInfo = createdUsers.find(u => u.email === 'elena@company.local');
  const marioInfo = createdUsers.find(u => u.email === 'mario@company.local');
  const raulInfo = createdUsers.find(u => u.email === 'raul@company.local');
  const claudiaInfo = createdUsers.find(u => u.email === 'claudia@company.local');
  const ivanInfo = createdUsers.find(u => u.email === 'ivan@company.local');
  const martaInfo = createdUsers.find(u => u.email === 'marta@company.local');

  const nextMonday = addDays(monday, 7);
  let count = 0;

  // ============================================================
  // SEMANA ACTUAL (Lunes a Domingo)
  // ============================================================

  // --- LUNES ---
  // Nuria: Guardia matutina TFN
  if (nuriaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      nuriaInfo.id,
      mainBranchId,
      'Guardia Matutina TFN',
      scheduleTypesByValue.get('guardia')!,
      '#2563eb',
      false,
      setHours(setMinutes(addDays(monday, 0), 0), 8),
      setHours(setMinutes(addDays(monday, 0), 0), 14),
      nuriaInfo.departmentId
    );
    count++;
  }

  // Andrés: Soporte mañana TFN
  if (andresInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      andresInfo.id,
      mainBranchId,
      'Soporte Técnico TFN',
      scheduleTypesByValue.get('otro')!,
      '#0f766e',
      false,
      setHours(setMinutes(addDays(monday, 0), 0), 9),
      setHours(setMinutes(addDays(monday, 0), 0), 17),
      andresInfo.departmentId
    );
    count++;
  }

  // Elena: Mantenimiento semanal
  if (elenaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      elenaInfo.id,
      mainBranchId,
      'Mantenimiento Semanal TFN',
      scheduleTypesByValue.get('otro')!,
      '#16a34a',
      false,
      setHours(setMinutes(addDays(monday, 0), 0), 7),
      setHours(setMinutes(addDays(monday, 0), 0), 15),
      elenaInfo.departmentId
    );
    count++;
  }

  // Claudia: Guardia Nocturna GC (empieza lunes noche, termina martes madrugada)
  if (claudiaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      claudiaInfo.id,
      secondBranchId,
      'Guardia Nocturna GC',
      scheduleTypesByValue.get('guardia')!,
      '#7c3aed',
      false,
      setHours(setMinutes(addDays(monday, 0), 0), 22),
      setHours(setMinutes(addDays(monday, 1), 0), 6),
      claudiaInfo.departmentId
    );
    count++;
  }

  // --- MARTES ---
  // Nuria: Formación en seguridad
  if (nuriaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      nuriaInfo.id,
      mainBranchId,
      'Formación Seguridad TFN',
      scheduleTypesByValue.get('formacion')!,
      '#0e7490',
      false,
      setHours(setMinutes(addDays(monday, 1), 0), 10),
      setHours(setMinutes(addDays(monday, 1), 0), 13),
      nuriaInfo.departmentId
    );
    count++;
  }

  // Mario: Atención al cliente GC
  if (marioInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      marioInfo.id,
      secondBranchId,
      'Atención Clientes GC',
      scheduleTypesByValue.get('otro')!,
      '#0ea5e9',
      false,
      setHours(setMinutes(addDays(monday, 1), 0), 9),
      setHours(setMinutes(addDays(monday, 1), 0), 14),
      marioInfo.departmentId
    );
    count++;
  }

  // Iván: Auditoría administrativa GC
  if (ivanInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      ivanInfo.id,
      secondBranchId,
      'Auditoría Administrativa GC',
      scheduleTypesByValue.get('otro')!,
      '#8b5cf6',
      false,
      setHours(setMinutes(addDays(monday, 1), 0), 8),
      setHours(setMinutes(addDays(monday, 1), 0), 15),
      ivanInfo.departmentId
    );
    count++;
  }

  // --- MIÉRCOLES ---
  // Andrés: Guardia Extraordinaria (last minute)
  if (andresInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      andresInfo.id,
      mainBranchId,
      'Guardia Extraordinaria TFN',
      scheduleTypesByValue.get('guardia')!,
      '#db2777',
      true,
      setHours(setMinutes(addDays(monday, 2), 0), 14),
      setHours(setMinutes(addDays(monday, 2), 0), 20),
      andresInfo.departmentId
    );
    count++;
  }

  // Raúl: Formación equipos GC
  if (raulInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      raulInfo.id,
      secondBranchId,
      'Formación Equipos GC',
      scheduleTypesByValue.get('formacion')!,
      '#d97706',
      false,
      setHours(setMinutes(addDays(monday, 2), 0), 10),
      setHours(setMinutes(addDays(monday, 2), 0), 13),
      raulInfo.departmentId
    );
    count++;
  }

  // Marta: Supervisión seguridad GC
  if (martaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      martaInfo.id,
      secondBranchId,
      'Supervisión Seguridad GC',
      scheduleTypesByValue.get('guardia')!,
      '#059669',
      false,
      setHours(setMinutes(addDays(monday, 2), 0), 8),
      setHours(setMinutes(addDays(monday, 2), 0), 16),
      martaInfo.departmentId
    );
    count++;
  }

  // Elena: Excepción — revisión urgente
  if (elenaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      elenaInfo.id,
      mainBranchId,
      'Revisión Urgente Equipos',
      scheduleTypesByValue.get('excepcion')!,
      '#dc2626',
      true,
      setHours(setMinutes(addDays(monday, 2), 0), 15),
      setHours(setMinutes(addDays(monday, 2), 0), 18),
      elenaInfo.departmentId
    );
    count++;
  }

  // --- JUEVES ---
  // Nuria: Guardia vespertina
  if (nuriaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      nuriaInfo.id,
      mainBranchId,
      'Guardia Vespertina TFN',
      scheduleTypesByValue.get('guardia')!,
      '#1d4ed8',
      false,
      setHours(setMinutes(addDays(monday, 3), 0), 14),
      setHours(setMinutes(addDays(monday, 3), 0), 22),
      nuriaInfo.departmentId
    );
    count++;
  }

  // Mario: Inventario GC
  if (marioInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      marioInfo.id,
      secondBranchId,
      'Inventario Almacén GC',
      scheduleTypesByValue.get('otro')!,
      '#0891b2',
      false,
      setHours(setMinutes(addDays(monday, 3), 0), 9),
      setHours(setMinutes(addDays(monday, 3), 0), 14),
      marioInfo.departmentId
    );
    count++;
  }

  // Claudia: Formación nocturna GC
  if (claudiaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      claudiaInfo.id,
      secondBranchId,
      'Formación Nocturna GC',
      scheduleTypesByValue.get('formacion')!,
      '#9333ea',
      false,
      setHours(setMinutes(addDays(monday, 3), 0), 20),
      setHours(setMinutes(addDays(monday, 3), 0), 23),
      claudiaInfo.departmentId
    );
    count++;
  }

  // --- VIERNES ---
  // Andrés: Soporte tarde
  if (andresInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      andresInfo.id,
      mainBranchId,
      'Soporte Tarde TFN',
      scheduleTypesByValue.get('otro')!,
      '#0d9488',
      false,
      setHours(setMinutes(addDays(monday, 4), 0), 14),
      setHours(setMinutes(addDays(monday, 4), 0), 20),
      andresInfo.departmentId
    );
    count++;
  }

  // Raúl: Mantenimiento preventivo GC
  if (raulInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      raulInfo.id,
      secondBranchId,
      'Mantenimiento Preventivo GC',
      scheduleTypesByValue.get('otro')!,
      '#65a30d',
      false,
      setHours(setMinutes(addDays(monday, 4), 0), 8),
      setHours(setMinutes(addDays(monday, 4), 0), 15),
      raulInfo.departmentId
    );
    count++;
  }

  // Iván: Cierre semanal GC
  if (ivanInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      ivanInfo.id,
      secondBranchId,
      'Cierre Semanal GC',
      scheduleTypesByValue.get('otro')!,
      '#a21caf',
      false,
      setHours(setMinutes(addDays(monday, 4), 0), 10),
      setHours(setMinutes(addDays(monday, 4), 0), 14),
      ivanInfo.departmentId
    );
    count++;
  }

  // --- SÁBADO ---
  // Marta: Guardia fin de semana GC
  if (martaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      martaInfo.id,
      secondBranchId,
      'Guardia Fin de Semana GC',
      scheduleTypesByValue.get('guardia')!,
      '#6366f1',
      false,
      setHours(setMinutes(addDays(monday, 5), 0), 8),
      setHours(setMinutes(addDays(monday, 5), 0), 20),
      martaInfo.departmentId
    );
    count++;
  }

  // Elena: Guardia sábado TFN
  if (elenaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      elenaInfo.id,
      mainBranchId,
      'Guardia Sábado TFN',
      scheduleTypesByValue.get('guardia')!,
      '#2563eb',
      false,
      setHours(setMinutes(addDays(monday, 5), 0), 9),
      setHours(setMinutes(addDays(monday, 5), 0), 15),
      elenaInfo.departmentId
    );
    count++;
  }

  // --- DOMINGO ---
  // Claudia: Guardia domingo GC
  if (claudiaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      claudiaInfo.id,
      secondBranchId,
      'Guardia Domingo GC',
      scheduleTypesByValue.get('guardia')!,
      '#7c3aed',
      false,
      setHours(setMinutes(addDays(monday, 6), 0), 10),
      setHours(setMinutes(addDays(monday, 6), 0), 18),
      claudiaInfo.departmentId
    );
    count++;
  }

  // ============================================================
  // SEMANA SIGUIENTE (Lunes a Viernes)
  // ============================================================

  // --- LUNES SIGUIENTE ---
  // Nuria: Coordinación semanal
  if (nuriaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      nuriaInfo.id,
      mainBranchId,
      'Coordinación Semanal TFN',
      scheduleTypesByValue.get('otro')!,
      '#2563eb',
      false,
      setHours(setMinutes(addDays(nextMonday, 0), 0), 8),
      setHours(setMinutes(addDays(nextMonday, 0), 0), 12),
      nuriaInfo.departmentId
    );
    count++;
  }

  // Andrés: Soporte TI completo
  if (andresInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      andresInfo.id,
      mainBranchId,
      'Soporte TI Completo',
      scheduleTypesByValue.get('otro')!,
      '#0891b2',
      false,
      setHours(setMinutes(addDays(nextMonday, 0), 0), 9),
      setHours(setMinutes(addDays(nextMonday, 0), 0), 18),
      andresInfo.departmentId
    );
    count++;
  }

  // Mario: Recepción equipos GC
  if (marioInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      marioInfo.id,
      secondBranchId,
      'Recepción Equipos GC',
      scheduleTypesByValue.get('otro')!,
      '#0ea5e9',
      false,
      setHours(setMinutes(addDays(nextMonday, 0), 0), 8),
      setHours(setMinutes(addDays(nextMonday, 0), 0), 14),
      marioInfo.departmentId
    );
    count++;
  }

  // --- MARTES SIGUIENTE ---
  // Elena: Mantenimiento profundo
  if (elenaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      elenaInfo.id,
      mainBranchId,
      'Mantenimiento Profundo TFN',
      scheduleTypesByValue.get('otro')!,
      '#16a34a',
      false,
      setHours(setMinutes(addDays(nextMonday, 1), 0), 7),
      setHours(setMinutes(addDays(nextMonday, 1), 0), 16),
      elenaInfo.departmentId
    );
    count++;
  }

  // Raúl: Formación avanzada GC
  if (raulInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      raulInfo.id,
      secondBranchId,
      'Formación Avanzada GC',
      scheduleTypesByValue.get('formacion')!,
      '#d97706',
      false,
      setHours(setMinutes(addDays(nextMonday, 1), 0), 9),
      setHours(setMinutes(addDays(nextMonday, 1), 0), 14),
      raulInfo.departmentId
    );
    count++;
  }

  // Iván: Gestión documental GC
  if (ivanInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      ivanInfo.id,
      secondBranchId,
      'Gestión Documental GC',
      scheduleTypesByValue.get('otro')!,
      '#8b5cf6',
      false,
      setHours(setMinutes(addDays(nextMonday, 1), 0), 10),
      setHours(setMinutes(addDays(nextMonday, 1), 0), 16),
      ivanInfo.departmentId
    );
    count++;
  }

  // --- MIÉRCOLES SIGUIENTE ---
  // Manager: Reunión de coordinación
  await ensureSeedSchedule(
    prisma,
    adminUser.id,
    managerUser.id,
    mainBranchId,
    'Reunión de Coordinación TFN',
    scheduleTypesByValue.get('otro')!,
    '#4f46e5',
    false,
    setHours(setMinutes(addDays(nextMonday, 2), 0), 10),
    setHours(setMinutes(addDays(nextMonday, 2), 0), 12),
    managerUser.departmentId
  );
  count++;

  // Nuria: Guardia especial
  if (nuriaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      nuriaInfo.id,
      mainBranchId,
      'Guardia Especial TFN',
      scheduleTypesByValue.get('guardia')!,
      '#1d4ed8',
      false,
      setHours(setMinutes(addDays(nextMonday, 2), 0), 14),
      setHours(setMinutes(addDays(nextMonday, 2), 0), 22),
      nuriaInfo.departmentId
    );
    count++;
  }

  // Marta: Supervisión nocturna GC
  if (martaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      martaInfo.id,
      secondBranchId,
      'Supervisión Nocturna GC',
      scheduleTypesByValue.get('guardia')!,
      '#059669',
      false,
      setHours(setMinutes(addDays(nextMonday, 2), 0), 20),
      setHours(setMinutes(addDays(nextMonday, 2), 0), 6),
      martaInfo.departmentId
    );
    count++;
  }

  // --- JUEVES SIGUIENTE ---
  // Andrés: Despliegue actualización
  if (andresInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      andresInfo.id,
      mainBranchId,
      'Despliegue Actualización TFN',
      scheduleTypesByValue.get('otro')!,
      '#0d9488',
      false,
      setHours(setMinutes(addDays(nextMonday, 3), 0), 8),
      setHours(setMinutes(addDays(nextMonday, 3), 0), 17),
      andresInfo.departmentId
    );
    count++;
  }

  // Claudia: Guardia diurna GC
  if (claudiaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      claudiaInfo.id,
      secondBranchId,
      'Guardia Diurna GC',
      scheduleTypesByValue.get('guardia')!,
      '#7c3aed',
      false,
      setHours(setMinutes(addDays(nextMonday, 3), 0), 8),
      setHours(setMinutes(addDays(nextMonday, 3), 0), 16),
      claudiaInfo.departmentId
    );
    count++;
  }

  // Mario: Logística GC
  if (marioInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      marioInfo.id,
      secondBranchId,
      'Logística y Suministros GC',
      scheduleTypesByValue.get('otro')!,
      '#0891b2',
      false,
      setHours(setMinutes(addDays(nextMonday, 3), 0), 9),
      setHours(setMinutes(addDays(nextMonday, 3), 0), 15),
      marioInfo.departmentId
    );
    count++;
  }

  // --- VIERNES SIGUIENTE ---
  // Elena: Cierre mantenimiento
  if (elenaInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      elenaInfo.id,
      mainBranchId,
      'Cierre Mantenimiento TFN',
      scheduleTypesByValue.get('otro')!,
      '#65a30d',
      false,
      setHours(setMinutes(addDays(nextMonday, 4), 0), 7),
      setHours(setMinutes(addDays(nextMonday, 4), 0), 14),
      elenaInfo.departmentId
    );
    count++;
  }

  // Raúl: Informe semanal GC
  if (raulInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      raulInfo.id,
      secondBranchId,
      'Informe Semanal GC',
      scheduleTypesByValue.get('otro')!,
      '#d97706',
      false,
      setHours(setMinutes(addDays(nextMonday, 4), 0), 10),
      setHours(setMinutes(addDays(nextMonday, 4), 0), 13),
      raulInfo.departmentId
    );
    count++;
  }

  // Iván: Cierre mensual GC
  if (ivanInfo) {
    await ensureSeedSchedule(
      prisma,
      adminUser.id,
      ivanInfo.id,
      secondBranchId,
      'Cierre Mensual GC',
      scheduleTypesByValue.get('otro')!,
      '#a21caf',
      false,
      setHours(setMinutes(addDays(nextMonday, 4), 0), 9),
      setHours(setMinutes(addDays(nextMonday, 4), 0), 15),
      ivanInfo.departmentId
    );
    count++;
  }

  // ============================================================
  // EVENTOS OVERLAP (STRESS TEST) — Miércoles de la semana actual
  // ============================================================
  console.log('BLOQUE: STRESS TEST (OVERLAPS)');
  const wednesday = addDays(monday, 2);
  const stressStart = setHours(setMinutes(wednesday, 0), 10);
  const stressEnd = setHours(setMinutes(wednesday, 0), 12);

  const stressTasks = [
    { user: adminUser, title: 'Reunión de Coordinación', type: 'otro', color: '#4f46e5' },
    { user: managerUser, title: 'Formación Operativa', type: 'formacion', color: '#0891b2' },
  ];

  for (const task of stressTasks) {
    if (task.user) {
      await ensureSeedSchedule(
        prisma,
        adminUser.id,
        task.user.id,
        mainBranchId,
        task.title,
        scheduleTypesByValue.get(task.type)!,
        task.color,
        false,
        stressStart,
        stressEnd,
        task.user.departmentId
      );
      count++;
    }
  }

  console.log(`[SCHEDULE] ${count} schedules created`);
}

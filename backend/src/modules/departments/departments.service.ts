import { createAppError } from '../../common/errors/error-catalog';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { logAuditOrThrow } from '../audit/audit.service';
import { ensureUserRole, downgradeManagerIfLast } from '../common/manager-utils';
import { assertUniqueField } from '../common/reactivation-utils';
import { findBranchById } from '../branches/branches.repository';
import { findUserById } from '../users/users.repository';
import {
  countAbsencesByDepartment,
  countDepartmentsForManager,
  createDepartmentRecord,
  deleteDepartmentManager,
  findDepartmentByCode,
  findDepartmentByName,
  findDepartmentById,
  findDepartmentBranchIds,
  findDepartmentCodeConflict,
  findDepartmentNameConflict,
  findDepartmentBranches,
  findDepartmentMembers,
  findDepartmentsByBranch,
  findDepartments,
  hardDeleteDepartmentRecord,
  removeDepartmentBranches,
  softDeleteDepartmentRecord,
  setDepartmentBranches,
  upsertDepartmentManager,
  updateDepartmentRecord,
} from './departments.repository';
import { normalizeDepartmentCode, normalizeDepartmentName } from './domain/departments.rules';
import type { DepartmentActor, DepartmentInput, ListDepartmentsParams } from './domain/departments.types';

/**
 * @description Número máximo de departamentos a los que un mismo usuario puede estar asignado como manager.
 */
const MAX_DEPARTMENTS_PER_MANAGER = 5;

async function ensureBranch(branchId: string) {
  const branch = await findBranchById(branchId);
  if (!branch) throw createAppError('BAD_REQUEST', 'La sucursal seleccionada no existe');
  return branch;
}

async function ensureBranchesExist(branchIds: string[]) {
  const branches = await Promise.all(branchIds.map((branchId) => findBranchById(branchId)));
  const missing = branchIds.filter((_, index) => !branches[index]);
  if (missing.length > 0) {
    throw createAppError('BAD_REQUEST', `Las siguientes sucursales no existen: ${missing.join(', ')}`);
  }
}

async function ensureDepartment(departmentId: string) {
  const department = await findDepartmentById(departmentId);
  if (!department) throw createAppError('NOT_FOUND', 'Departamento no encontrado');
  return department;
}

async function buildDepartmentSnapshot(departmentId: string, tx?: Parameters<typeof findDepartmentById>[1]) {
  const [department, branchLinks] = await Promise.all([
    findDepartmentById(departmentId, tx),
    findDepartmentBranchIds(departmentId, tx),
  ]);

  if (!department) {
    throw createAppError('NOT_FOUND', 'Departamento no encontrado');
  }

  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description ?? null,
    isActive: department.isActive,
    branchIds: branchLinks.map((link) => link.branchId),
    userCount: department._count?.users ?? 0,
  };
}

export async function listDepartments(params: ListDepartmentsParams) {
  const actor = params.actor;
  const roleNameNorm = String(actor?.roleName ?? '').trim().toLowerCase();

  if (roleNameNorm === 'employee') {
    const homeBranch = actor?.branchId ?? undefined;
    const effectiveBranch = params.branchId ?? homeBranch;
    if (!effectiveBranch) {
      return [];
    }
    const allowed = new Set(
      [actor?.branchId, ...(actor?.visibleBranchIds ?? [])].filter((x): x is string => Boolean(x)),
    );
    if (!allowed.has(effectiveBranch)) {
      throw createAppError('FORBIDDEN', 'No puedes consultar departamentos de otra sede');
    }
    await ensureBranch(effectiveBranch);
    return findDepartmentsByBranch(effectiveBranch, params.includeInactive);
  }

  if (params.branchId) {
    await ensureBranch(params.branchId);
    return findDepartmentsByBranch(params.branchId, params.includeInactive);
  }
  return findDepartments(params.includeInactive ? {} : { isActive: true });
}

export async function createDepartment(data: DepartmentInput, actor: DepartmentActor) {
  if (!data.branchIds?.length) {
    throw createAppError('BAD_REQUEST', 'Debe seleccionar al menos una sucursal');
  }
  await ensureBranchesExist(data.branchIds);

  const code = normalizeDepartmentCode(data.code);
  const name = normalizeDepartmentName(data.name);

  const existingByCode = await findDepartmentByCode(code);
  if (existingByCode) {
    if (!existingByCode.isActive) {
      throw createAppError('CONFLICT',
        `Ya existe un departamento con el código "${code}" (actualmente desactivado). Reactívalo o elige otro código.`);
    }
    throw createAppError('CONFLICT', 'Ya existe un departamento con ese código');
  }

  const existingByName = await findDepartmentByName(name);
  if (existingByName) {
    if (!existingByName.isActive) {
      throw createAppError('CONFLICT',
        `Ya existe un departamento con el nombre "${name}" (actualmente desactivado). Reactívalo o elige otro nombre.`);
    }
    throw createAppError('CONFLICT', 'Ya existe un departamento con ese nombre');
  }

  return executeInTransaction(async (tx) => {
    const department = await createDepartmentRecord({
      name,
      code,
      description: data.description,
    }, tx);

    await setDepartmentBranches(department.id, data.branchIds, tx);

    const after = await buildDepartmentSnapshot(department.id, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'CREATE_DEPARTMENT',
      entityType: 'Department',
      entityId: department.id,
      detailsJson: { before: null, after },
      ipAddress: actor.ipAddress,
    }, tx);

    return department;
  });
}

export async function updateDepartment(departmentId: string, data: Partial<DepartmentInput>, actor: DepartmentActor) {
  const before = await buildDepartmentSnapshot(departmentId);

  if (data.branchIds) {
    if (!data.branchIds.length) {
      throw createAppError('BAD_REQUEST', 'Debe seleccionar al menos una sucursal');
    }
    await ensureBranchesExist(data.branchIds);
  }

  if (data.code) {
    const code = normalizeDepartmentCode(data.code);
    const conflict = await findDepartmentCodeConflict(code, departmentId);
    if (conflict) {
      throw createAppError('CONFLICT', 'Ya existe un departamento con ese código');
    }
    data.code = code;
  }

  if (data.name) {
    const name = normalizeDepartmentName(data.name);
    const conflict = await findDepartmentNameConflict(name, departmentId);
    if (conflict) {
      throw createAppError('CONFLICT', 'Ya existe un departamento con ese nombre');
    }
    data.name = name;
  }

  return executeInTransaction(async (tx) => {
    // Extraer branchIds para no pasarlo a Prisma como campo directo del modelo Department
    const { branchIds, ...departmentData } = data;
    const updated = await updateDepartmentRecord(departmentId, {
      ...departmentData,
      description: data.description,
    }, tx);

    if (branchIds) {
      await removeDepartmentBranches(departmentId, tx);
      await setDepartmentBranches(departmentId, branchIds, tx);
    }

    const after = await buildDepartmentSnapshot(departmentId, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'UPDATE_DEPARTMENT',
      entityType: 'Department',
      entityId: departmentId,
      detailsJson: { before, after },
      ipAddress: actor.ipAddress,
    }, tx);

    return updated;
  });
}

export async function deleteDepartment(departmentId: string, actor: DepartmentActor) {
  const before = await buildDepartmentSnapshot(departmentId);

  const userCount = before.userCount;
  if (userCount > 0) {
    throw createAppError(
      'BAD_REQUEST',
      `No se puede eliminar: ${userCount} usuario(s) están asignados a este departamento. Desasigna los usuarios primero.`,
      { linkedUsers: userCount },
    );
  }

  const linkedAbsences = await countAbsencesByDepartment(departmentId);
  if (linkedAbsences > 0) {
    throw createAppError(
      'BAD_REQUEST',
      `No se puede eliminar: ${linkedAbsences} ausencia(s) están asociadas a este departamento. Cancélalas o reasígnalas primero.`,
      { linkedAbsences },
    );
  }

  await executeInTransaction(async (tx) => {
    await softDeleteDepartmentRecord(departmentId, tx);
    const after = await buildDepartmentSnapshot(departmentId, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'DELETE_DEPARTMENT',
      entityType: 'Department',
      entityId: departmentId,
      detailsJson: { before, after },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

export async function reactivateDepartment(departmentId: string, actor: DepartmentActor) {
  const before = await buildDepartmentSnapshot(departmentId);
  if (before.isActive) throw createAppError('BAD_REQUEST', 'El departamento ya está activo');

  await assertUniqueField({
    lookup: (value) => findDepartmentByCode(value),
    entityLabel: 'departamento',
    fieldLabel: 'código',
  }, 'code', before.code, departmentId);

  await assertUniqueField({
    lookup: (value) => findDepartmentByName(value),
    entityLabel: 'departamento',
    fieldLabel: 'nombre',
  }, 'name', before.name, departmentId);

  return executeInTransaction(async (tx) => {
    const updated = await updateDepartmentRecord(departmentId, { isActive: true }, tx);
    const after = await buildDepartmentSnapshot(departmentId, tx);
    await logAuditOrThrow({
      userId: actor.id,
      action: 'REACTIVATE_DEPARTMENT',
      entityType: 'Department',
      entityId: departmentId,
      detailsJson: { before, after },
      ipAddress: actor.ipAddress,
    }, tx);
    return updated;
  });
}

export async function hardDeleteDepartment(departmentId: string, actor: DepartmentActor) {
  const before = await buildDepartmentSnapshot(departmentId);

  const userCount = before.userCount;
  if (userCount > 0) {
    throw createAppError(
      'BAD_REQUEST',
      `No se puede eliminar: ${userCount} usuario(s) están asignados a este departamento. Desasigna los usuarios primero.`,
      { linkedUsers: userCount },
    );
  }

  const linkedAbsences = await countAbsencesByDepartment(departmentId);
  if (linkedAbsences > 0) {
    throw createAppError(
      'BAD_REQUEST',
      `No se puede eliminar: ${linkedAbsences} ausencia(s) están asociadas a este departamento. Cancélalas o reasígnalas primero.`,
      { linkedAbsences },
    );
  }

  await executeInTransaction(async (tx) => {
    await removeDepartmentBranches(departmentId, tx);
    await hardDeleteDepartmentRecord(departmentId, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'HARD_DELETE_DEPARTMENT',
      entityType: 'Department',
      entityId: departmentId,
      detailsJson: { before, after: null },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

export async function getDepartmentBranches(departmentId: string) {
  await ensureDepartment(departmentId);
  return findDepartmentBranches(departmentId);
}

/**
 * Obtiene los miembros activos de un departamento.
 */
export async function getDepartmentMembers(departmentId: string) {
  await ensureDepartment(departmentId);
  return findDepartmentMembers(departmentId);
}

/**
 * Asigna un manager a un departamento dentro de una transacción única.
 * Si el usuario no tiene el rol 'department_manager', se le otorga.
 * Valida que el usuario no exceda el máximo de departamentos permitidos.
 * Genera auditoría atómica.
 */
export async function assignDepartmentManager(
  departmentId: string,
  userId: string,
  actor: DepartmentActor,
) {
  const department = await ensureDepartment(departmentId);
  const user = await findUserById(userId);
  if (!user) throw createAppError('NOT_FOUND', 'Usuario no encontrado');

  const isAlreadyManager = department.managers?.some((m) => m.userId === userId);
  if (isAlreadyManager) {
    throw createAppError('BAD_REQUEST', 'Este usuario ya es manager de este departamento');
  }

  // Validar que el usuario no exceda el máximo de departamentos como manager
  const currentManagerCount = await countDepartmentsForManager(userId);
  if (currentManagerCount >= MAX_DEPARTMENTS_PER_MANAGER) {
    throw createAppError(
      'BAD_REQUEST',
      `El usuario ya es manager de ${currentManagerCount} departamento(s). No puede superar el límite de ${MAX_DEPARTMENTS_PER_MANAGER}.`,
    );
  }

  return executeInTransaction(async (tx) => {
    // 1. Asignar manager mediante la tabla intermedia
    await upsertDepartmentManager(departmentId, userId, tx);

    // 2. Otorgar rol si no lo tiene
    await ensureUserRole(userId, 'department_manager', tx);

    // 3. Auditoría
    await logAuditOrThrow({
      userId: actor.id,
      action: 'ASSIGN_DEPARTMENT_MANAGER',
      entityType: 'Department',
      entityId: departmentId,
      detailsJson: {
        departmentName: department.name,
        managerName: user.name,
        managerId: userId,
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return department;
  });
}

/**
 * Remueve un manager de un departamento dentro de una transacción única.
 * Si no se especifica userId, remueve el primer manager encontrado.
 * Si el usuario no es manager de otros departamentos, se le quita el rol 'employee'.
 * Genera auditoría atómica.
 */
export async function removeDepartmentManager(
  departmentId: string,
  userId: string | undefined,
  actor: DepartmentActor,
) {
  const department = await ensureDepartment(departmentId);

  let managerId: string;
  if (userId) {
    managerId = userId;
  } else {
    const firstManager = department.managers?.[0];
    if (!firstManager) {
      throw createAppError('BAD_REQUEST', 'Este departamento no tiene un manager asignado');
    }
    managerId = firstManager.userId;
  }

  const manager = await findUserById(managerId);
  if (!manager) throw createAppError('NOT_FOUND', 'Manager no encontrado');

  const isManager = department.managers?.some((m) => m.userId === managerId);
  if (!isManager) {
    throw createAppError('BAD_REQUEST', 'Este usuario no es manager de este departamento');
  }

  return executeInTransaction(async (tx) => {
    // 1. Remover manager del departamento
    await deleteDepartmentManager(departmentId, managerId, tx);

    // 2. Si no es manager de ningún otro, quitar el rol
    const remainingDepartments = await countDepartmentsForManager(managerId, tx);
    await downgradeManagerIfLast(managerId, (t) => countDepartmentsForManager(managerId, t), tx);

    // 3. Auditoría
    await logAuditOrThrow({
      userId: actor.id,
      action: 'REMOVE_DEPARTMENT_MANAGER',
      entityType: 'Department',
      entityId: departmentId,
      detailsJson: {
        departmentName: department.name,
        formerManagerName: manager.name,
        formerManagerId: managerId,
        stillManagerOfOtherDepartments: remainingDepartments > 0,
      },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

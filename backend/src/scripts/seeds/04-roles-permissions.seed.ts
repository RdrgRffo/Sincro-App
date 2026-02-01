import { PrismaClient } from '@prisma/client';
import { ROLE_NAMES, DEFAULT_ROLE_PERMISSIONS } from '../../modules/roles/roles.constants';

export async function seedRolesAndPermissions(prisma: PrismaClient) {
  console.log('BLOQUE: ROLES Y PERMISOS');

  const rolesData = ROLE_NAMES.map(name => ({
    name,
    permissions: DEFAULT_ROLE_PERMISSIONS[name] || []
  }));

  const dbRoles: Record<string, string> = {};
  const allPermissions = new Set(rolesData.flatMap(r => r.permissions || []));

  // Create permissions
  for (const perm of allPermissions) {
    await prisma.permission.upsert({
      where: { name: perm },
      create: { name: perm },
      update: {},
    });
  }
  console.log(`[PERMISSION] ${allPermissions.size} permissions ensured`);

  // Create/Update roles
  for (const roleDef of rolesData) {
    let role = await prisma.role.findUnique({ where: { name: roleDef.name } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          permissions: {
            connect: roleDef.permissions.map(name => ({ name }))
          }
        }
      });
      console.log(`[ROLE] Created role ${roleDef.name}`);
    } else {
      role = await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: {
            connect: roleDef.permissions.map(name => ({ name }))
          }
        }
      });
      console.log(`[ROLE] Role ${roleDef.name} already exists`);
    }
    dbRoles[roleDef.name] = role.id;
  }

  return dbRoles;
}

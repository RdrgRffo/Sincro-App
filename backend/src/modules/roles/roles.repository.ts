import { prisma } from '../../config/database';

export async function findRoles() {
  return prisma.role.findMany({ include: { permissions: true } });
}

export async function findRoleById(id: string) {
  return prisma.role.findUnique({
    where: { id },
    include: { permissions: true },
  });
}

export async function findRoleByName(name: string) {
  return prisma.role.findFirst({
    where: { name },
    select: { id: true, name: true },
  });
}

export async function createRole(data: { name: string; description?: string | null; permissions?: string[] }) {
  return prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      permissions: {
        connect: data.permissions?.map(name => ({ name })) || [],
      },
    },
    include: { permissions: true },
  });
}

export async function updateRole(id: string, data: { name?: string; description?: string | null; permissions?: string[] }) {
  return prisma.role.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.permissions && {
        permissions: {
          set: data.permissions.map(name => ({ name })),
        },
      }),
    },
    include: { permissions: true },
  });
}

export async function deleteRole(id: string) {
  return prisma.role.delete({ where: { id } });
}

export async function getPermissions() {
  return prisma.permission.findMany();
}

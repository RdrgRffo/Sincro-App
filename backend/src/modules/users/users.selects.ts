import { Prisma } from '@prisma/client';

/** `satisfies` mantiene el literal del select para que `UserResponse` incluya `skills.skill` y `visibleBranches.branch`. */
export const USER_RESPONSE_SELECT = {
  id: true,
  employeeId: true,
  name: true,
  email: true,
  derivedUsername: true,
  passwordChangedAt: true,
  tokenVersion: true,
  roleId: true,
  role: {
    select: {
      name: true,
      permissions: {
        select: {
          name: true,
        },
      },
    },
  },
  status: true,
  avatarUrl: true,
  createdAt: true,
  lastLoginAt: true,
  failedAttempts: true,
  forcePasswordChange: true,
  passwordChangePolicy: true,
  passwordChangeWarnedAt: true,
  passwordChangeDeadlineAt: true,
  companyPhone: true,
  auxiliaryPhone: true,
  branchId: true,
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  },
  visibleBranches: {
    select: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
      assignedAt: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  skills: {
    select: {
      level: true,
      expiresAt: true,
      notes: true,
      assignedAt: true,
      skill: {
        select: {
          id: true,
          name: true,
          category: true,
          color: true,
          description: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export const USER_SAFE_SELECT = {
  id: true,
  employeeId: true,
  name: true,
  email: true,
  derivedUsername: true,
  passwordChangedAt: true,
  tokenVersion: true,
  roleId: true,
  role: {
    select: {
      name: true,
      permissions: {
        select: {
          name: true,
        },
      },
    },
  },
  status: true,
  avatarUrl: true,
  createdAt: true,
  lastLoginAt: true,
  failedAttempts: true,
  forcePasswordChange: true,
  passwordChangePolicy: true,
  passwordChangeWarnedAt: true,
  passwordChangeDeadlineAt: true,
  companyPhone: true,
  auxiliaryPhone: true,
  branchId: true,
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  },
  visibleBranches: {
    select: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
      assignedAt: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  skills: {
    select: {
      level: true,
      expiresAt: true,
      notes: true,
      assignedAt: true,
      skill: {
        select: {
          id: true,
          name: true,
          category: true,
          color: true,
          description: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type UserResponse = Prisma.UserGetPayload<{ select: typeof USER_RESPONSE_SELECT }>;

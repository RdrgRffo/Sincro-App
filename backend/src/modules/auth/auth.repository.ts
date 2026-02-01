import { prisma } from '../../config/database';
import { TransactionClient } from '../../common/transactions/transaction.utils';
import { USER_RESPONSE_SELECT } from '../users/users.selects';

const AUTH_USER_SELECT = {
  ...USER_RESPONSE_SELECT,
  passwordHash: true,
} as const;

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export function findUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: AUTH_USER_SELECT,
  });
}

export function findUserProfileById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: USER_RESPONSE_SELECT,
  });
}

export function updateUserById(
  userId: string,
  data: {
    status?: string;
    failedAttempts?: number;
    lockedUntil?: Date | null;
    lastLoginAt?: Date;
    passwordHash?: string;
    passwordChangedAt?: Date;
    forcePasswordChange?: boolean;
    passwordChangePolicy?: string;
    passwordChangeWarnedAt?: Date | null;
    passwordChangeDeadlineAt?: Date | null;
    tokenVersion?: number | { increment: number };
  },
  tx?: TransactionClient,
) {
  return getDb(tx).user.update({
    where: { id: userId },
    data,
    select: USER_RESPONSE_SELECT,
  });
}

export function createRefreshToken(data: {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}, tx?: TransactionClient) {
  return getDb(tx).refreshToken.create({ data });
}

export function findRefreshTokenByToken(token: string) {
  return prisma.refreshToken.findUnique({ where: { token } });
}

export function revokeRefreshTokenById(id: string, tx?: TransactionClient) {
  return getDb(tx).refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export function revokeRefreshTokensByToken(token: string) {
  return prisma.refreshToken.updateMany({
    where: { token },
    data: { revokedAt: new Date() },
  });
}

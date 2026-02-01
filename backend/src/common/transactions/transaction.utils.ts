import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export type TransactionClient = Prisma.TransactionClient;

export async function executeInTransaction<T>(
  operation: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => operation(tx));
}

import { createAppError } from '../../common/errors/error-catalog';
import { prisma } from '../../config/database';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { logAuditOrThrow, sanitizeSnapshot } from '../audit/audit.service';
import type { PlanningActor } from './planning.types';
import type { PlanningCommentInput } from './planning.validation';

export class PlanningSupportManager {
  constructor(private readonly core?: any) {}

  /**
   * List comments for a planning entity.
   */
  async listComments(entityType: string, entityId: string) {
    return prisma.entityComment.findMany({
      where: { entityType, entityId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }).then((rows) =>
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  /**
   * Add a comment to a planning entity.
   */
  async addComment(input: PlanningCommentInput, actor: PlanningActor) {
    const body = input.body.trim();
    if (!body) throw createAppError('BAD_REQUEST', 'El comentario no puede estar vacío');

    const comment = await executeInTransaction(async (tx) => {
      const created = await tx.entityComment.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          body,
          authorId: actor.id,
        },
        include: { author: { select: { id: true, name: true } } },
      });

      await logAuditOrThrow(
        {
          userId: actor.id,
          action: 'CREATE_ENTITY_COMMENT',
          entityType: 'EntityComment',
          entityId: created.id,
          detailsJson: {
            before: null,
            after: sanitizeSnapshot({
              id: created.id,
              entityType: created.entityType,
              entityId: created.entityId,
              body: created.body.length > 500 ? `${created.body.slice(0, 500)}…` : created.body,
              authorId: created.authorId,
            }),
          },
        },
        tx,
      );

      return created;
    });

    return { ...comment, createdAt: comment.createdAt.toISOString() };
  }
}

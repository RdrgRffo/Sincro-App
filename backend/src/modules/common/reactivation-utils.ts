import { createAppError } from '../../common/errors/error-catalog';

type UniqueFieldLookup<T> = (value: string) => Promise<T | null | undefined>;

export type UniqueFieldModel<T> = {
  lookup: UniqueFieldLookup<T>;
  entityLabel: string;
  fieldLabel: string;
};

export async function assertUniqueField<T extends { id: string; isActive?: boolean }>(
  model: UniqueFieldModel<T>,
  field: string,
  value: string,
  excludeId: string,
) {
  const conflicting = await model.lookup(value);
  if (conflicting && conflicting.id !== excludeId && conflicting.isActive) {
    throw createAppError(
      'CONFLICT',
      `El ${model.fieldLabel ?? field} "${value}" ya está en uso por otra ${model.entityLabel} activa`,
    );
  }
}
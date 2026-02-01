import { env } from '../../config/env';

export const USER_STATUSES = ['active', 'disabled', 'locked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Contraseña temporal asignada en importación masiva — always bcrypt-hashed inside createUser. */
export const CSV_IMPORT_DEFAULT_PASSWORD = env.IMPORT_DEFAULT_PASSWORD;

/** Límite máximo de tamaño de archivo CSV para importación (5 MB). */
export const CSV_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;


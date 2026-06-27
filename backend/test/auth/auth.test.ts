/**
 * @file auth.test.ts
 * Tests del motor de autenticación: lockouts, cuentas deshabilitadas, rotación de tokens.
 */

// ── Mocks antes de imports ──────────────────────────────────────────────────
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/modules/auth/auth.repository');
jest.mock('../../src/utils/bcrypt', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue('hashed'),
}));
// Evitar que jwt real intente leer secrets
jest.mock('../../src/utils/jwt', () => ({
  signAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  signRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (operation: any) => {
    // Pasamos un objeto tx mock para que getDb(tx) lo use
    // y las aserciones con expect.anything() funcionen
    return operation({});
  }),
}));

import * as usersRepo from '../../src/modules/users/users.repository';
import * as authRepo from '../../src/modules/auth/auth.repository';
import * as bcryptUtils from '../../src/utils/bcrypt';
import { prismaMock } from '../config/singleton';
import { changePassword, getMe, login } from '../../src/modules/auth/auth.service';
import {
  USER_STATUS,
  LOGIN_LOCKOUT_FIRST_ATTEMPTS,
  LOGIN_LOCKOUT_FIRST_MINUTES,
  LOGIN_LOCKOUT_SECOND_ATTEMPTS,
  LOGIN_LOCKOUT_SECOND_MINUTES,
  LOGIN_LOCKOUT_DISABLE_ATTEMPTS,
} from '../../src/config/constants';

const mockUsersRepo = usersRepo as jest.Mocked<typeof usersRepo>;
const mockAuthRepo = authRepo as jest.Mocked<typeof authRepo>;
const mockBcrypt = bcryptUtils as jest.Mocked<typeof bcryptUtils>;

// ── Helper ───────────────────────────────────────────────────────────────────
const buildUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  email: 'user@test.com',
  name: 'Test',
  roleId: 'role-viewer-id',
  status: USER_STATUS.ACTIVE,
  failedAttempts: 0,
  passwordHash: 'hashed',
  lockedUntil: null,
  avatarUrl: null,
  department: null,
  createdAt: new Date(),
  passwordChangedAt: new Date(),
  lastLoginAt: null,
  forcePasswordChange: false,
  passwordChangePolicy: 'none',
  passwordChangeWarnedAt: null,
  passwordChangeDeadlineAt: null,
  companyPhone: null,
  auxiliaryPhone: null,
  tokenVersion: 0,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('login - Seguridad y Valores Límite', () => {
  beforeEach(() => {
    mockAuthRepo.createRefreshToken.mockResolvedValue(undefined as any);
    prismaMock.role.findFirst.mockImplementation(((args: any) => Promise.resolve({
      id: args?.where?.name === 'admin' ? 'role-admin-id' : 'role-viewer-id',
      name: args?.where?.name,
    })) as any);
    (mockAuthRepo.updateUserById as jest.Mock).mockImplementation(async (_id, data) => buildUser(data));
  });

  // ── Caso: Credenciales inválidas — usuario no existe ────────────────────────
  it('lanza UNAUTHORIZED genérico si el usuario no existe (protección de enumeración)', async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(null as any);

    await expect(login('ghost@test.com', 'password', '127.0.0.1'))
      .rejects.toThrow('Credenciales incorrectas');
  });

  // ── Caso: Cuenta DISABLED — acceso denegado independientemente de la password ─
  it('rechaza el acceso de una cuenta deshabilitada antes de verificar la password', async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({ status: USER_STATUS.DISABLED }) as any
    );

    await expect(login('user@test.com', 'AnyPass1!', '127.0.0.1'))
      .rejects.toThrow('Cuenta deshabilitada. Contacta con el administrador');

    // La password NO debe haberse comprobado (optimización de seguridad)
    expect(mockBcrypt.comparePassword).not.toHaveBeenCalled();
  });

  // ── Caso: Contraseña incorrecta → incrementa failedAttempts ─────────────────
  it('incrementa failedAttempts en BD tras una contraseña incorrecta', async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(buildUser({ failedAttempts: 1 }) as any);
    mockBcrypt.comparePassword.mockResolvedValue(false as never);

    await expect(login('user@test.com', 'WrongPass!', '127.0.0.1'))
      .rejects.toThrow('Credenciales incorrectas');

    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ failedAttempts: 2 })
    );
  });

  // ── Caso: 5º intento fallido → bloqueo 5 minutos ───────────────────────────
  it(`bloquea la cuenta 5 min al alcanzar exactamente ${LOGIN_LOCKOUT_FIRST_ATTEMPTS} intentos fallidos`, async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({ failedAttempts: LOGIN_LOCKOUT_FIRST_ATTEMPTS - 1 }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(false as never);

    await expect(login('user@test.com', 'WrongPass!', '127.0.0.1'))
      .rejects.toThrow('Credenciales incorrectas');

    const lockPatch = mockAuthRepo.updateUserById.mock.calls[0][1];
    expect(lockPatch).toEqual(
      expect.objectContaining({
        status: USER_STATUS.LOCKED,
        failedAttempts: LOGIN_LOCKOUT_FIRST_ATTEMPTS,
      })
    );
    const until = lockPatch.lockedUntil as Date;
    const deltaMin = (until.getTime() - Date.now()) / 60000;
    expect(deltaMin).toBeGreaterThan(LOGIN_LOCKOUT_FIRST_MINUTES - 0.5);
    expect(deltaMin).toBeLessThan(LOGIN_LOCKOUT_FIRST_MINUTES + 1);
  });

  // ── Caso: 10º intento fallido → bloqueo 30 minutos ──────────────────────────
  it(`bloquea la cuenta 30 min al alcanzar exactamente ${LOGIN_LOCKOUT_SECOND_ATTEMPTS} intentos fallidos`, async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({ failedAttempts: LOGIN_LOCKOUT_SECOND_ATTEMPTS - 1 }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(false as never);

    await expect(login('user@test.com', 'WrongPass!', '127.0.0.1'))
      .rejects.toThrow('Credenciales incorrectas');

    const lockPatch = mockAuthRepo.updateUserById.mock.calls[0][1];
    expect(lockPatch).toEqual(
      expect.objectContaining({
        status: USER_STATUS.LOCKED,
        failedAttempts: LOGIN_LOCKOUT_SECOND_ATTEMPTS,
      })
    );
    const until = lockPatch.lockedUntil as Date;
    const deltaMin = (until.getTime() - Date.now()) / 60000;
    expect(deltaMin).toBeGreaterThan(LOGIN_LOCKOUT_SECOND_MINUTES - 0.5);
    expect(deltaMin).toBeLessThan(LOGIN_LOCKOUT_SECOND_MINUTES + 1);
  });

  // ── Caso: 15º intento fallido → cuenta deshabilitada ────────────────────────
  it(`deshabilita la cuenta al alcanzar ${LOGIN_LOCKOUT_DISABLE_ATTEMPTS} intentos fallidos`, async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({ failedAttempts: LOGIN_LOCKOUT_DISABLE_ATTEMPTS - 1 }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(false as never);

    await expect(login('user@test.com', 'WrongPass!', '127.0.0.1'))
      .rejects.toThrow('Cuenta deshabilitada. Contacta con el administrador');

    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: USER_STATUS.DISABLED,
        failedAttempts: LOGIN_LOCKOUT_DISABLE_ATTEMPTS,
        lockedUntil: null,
      })
    );
  });

  // ── Caso: bloqueo expirado → no reinicia intentos; 6º fallo no vuelve a bloquear
  it('al expirar bloqueo mantiene failedAttempts y el 6º fallo no aplica nuevo lock', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({
        status: USER_STATUS.LOCKED,
        lockedUntil: pastDate,
        failedAttempts: LOGIN_LOCKOUT_FIRST_ATTEMPTS,
      }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(false as never);

    await expect(login('user@test.com', 'WrongPass!', '127.0.0.1'))
      .rejects.toThrow('Credenciales incorrectas');

    expect(mockAuthRepo.updateUserById).toHaveBeenNthCalledWith(
      1,
      'user-1',
      expect.objectContaining({ status: USER_STATUS.ACTIVE, lockedUntil: null })
    );
    expect(mockAuthRepo.updateUserById).toHaveBeenNthCalledWith(
      2,
      'user-1',
      expect.objectContaining({ failedAttempts: 6 })
    );
    expect(mockAuthRepo.updateUserById.mock.calls[1][1]).not.toHaveProperty('status');
  });

  // ── Caso: Login exitoso — resetea intentos fallidos ─────────────────────────
  it('resetea failedAttempts a 0 y actualiza lastLoginAt tras login correcto', async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(buildUser() as any);
    mockBcrypt.comparePassword.mockResolvedValue(true as never);

    const result = await login('user@test.com', 'CorrectPass!', '127.0.0.1');

    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ failedAttempts: 0 }),
      expect.anything()
    );
  });

  it('devuelve estado warning cuando existe aviso preventivo vigente', async () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000);
    mockAuthRepo.updateUserById.mockResolvedValueOnce(
      buildUser({
        passwordChangePolicy: 'warning',
        passwordChangeDeadlineAt: deadline,
      }) as any
    );
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({
        passwordChangePolicy: 'warning',
        passwordChangeDeadlineAt: deadline,
      }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(true as never);

    const result = await login('user@test.com', 'CorrectPass!', '127.0.0.1');

    expect(result.user.passwordChangeState).toBe('warning');
    expect(result.user.forcePasswordChange).toBe(false);
  });

  it('convierte warning expirado a required y lo persiste', async () => {
    const expiredDeadline = new Date(Date.now() - 5 * 60 * 1000);
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({
        passwordChangePolicy: 'warning',
        passwordChangeDeadlineAt: expiredDeadline,
      }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(true as never);

    const result = await login('user@test.com', 'CorrectPass!', '127.0.0.1');

    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        forcePasswordChange: true,
        passwordChangePolicy: 'required',
      }),
      expect.anything()
    );
    expect(result.user.passwordChangeState).toBe('required');
    expect(result.user.forcePasswordChange).toBe(true);
  });

  it('activa warning automático cuando pasaron 3 meses desde passwordChangedAt', async () => {
    const oldPasswordDate = new Date();
    oldPasswordDate.setMonth(oldPasswordDate.getMonth() - 3);
    oldPasswordDate.setDate(oldPasswordDate.getDate() - 1);

    const nextDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockAuthRepo.updateUserById.mockResolvedValueOnce(
      buildUser({
        passwordChangePolicy: 'warning',
        passwordChangeWarnedAt: new Date(),
        passwordChangeDeadlineAt: nextDeadline,
      }) as any
    );
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({
        passwordChangePolicy: 'none',
        forcePasswordChange: false,
        passwordChangedAt: oldPasswordDate,
      }) as any
    );
    mockBcrypt.comparePassword.mockResolvedValue(true as never);

    const result = await login('user@test.com', 'CorrectPass!', '127.0.0.1');
    // DB update may be performed inside the transaction; assert the effective state instead.
    expect(result.user.passwordChangeState).toBe('warning');
  });

  // ── Caso: Login exitoso con username derivado ────────────────────────
  it('permite login usando el username derivado del email', async () => {
    mockUsersRepo.findUserByEmail.mockResolvedValue(null as any); // No match on full email
    mockUsersRepo.findUserByDerivedUsername.mockResolvedValue(buildUser() as any);
    mockBcrypt.comparePassword.mockResolvedValue(true as never);

    const result = await login('user', 'CorrectPass!', '127.0.0.1'); // 'user' instead of 'user@test.com'

    expect(result.accessToken).toBe('mock-access-token');
    expect(mockUsersRepo.findUserByDerivedUsername).toHaveBeenCalledWith('user');
    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ failedAttempts: 0 }),
      expect.anything()
    );
  });

  // ── Caso: Cuenta bloqueada con lockedUntil en el futuro — deniega acceso ────
  it('deniega acceso a cuenta bloqueada cuyo lockedUntil está en el futuro', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // +1 hora
    mockUsersRepo.findUserByEmail.mockResolvedValue(
      buildUser({ status: USER_STATUS.LOCKED, lockedUntil: futureDate }) as any
    );

    await expect(login('user@test.com', 'AnyPass!', '127.0.0.1'))
      .rejects.toThrow(/Cuenta bloqueada/);
  });
});

describe('password policy helpers in auth.service', () => {
  beforeEach(() => {
    (mockAuthRepo.updateUserById as jest.Mock).mockImplementation(async (_id, data) => buildUser(data));
    mockAuthRepo.findUserById.mockResolvedValue(buildUser() as any);
  });

  it('getMe eleva warning expirado a required', async () => {
    const expiredDeadline = new Date(Date.now() - 5 * 60 * 1000);
    mockAuthRepo.findUserProfileById
      .mockResolvedValueOnce(buildUser({
        passwordChangePolicy: 'warning',
        passwordChangeDeadlineAt: expiredDeadline,
      }) as any)
      .mockResolvedValueOnce(buildUser({
        passwordChangePolicy: 'required',
        forcePasswordChange: true,
      }) as any);

    const me = await getMe('user-1');

    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ passwordChangePolicy: 'required', forcePasswordChange: true })
    );
    expect(me.passwordChangeState).toBe('required');
  });

  it('changePassword limpia estado required/warning', async () => {
    mockAuthRepo.findUserById.mockResolvedValue(buildUser({
      forcePasswordChange: true,
      passwordChangePolicy: 'required',
    }) as any);

    await changePassword('user-1', undefined, 'NewSecure123!');

    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        forcePasswordChange: false,
        passwordChangePolicy: 'none',
        passwordChangeWarnedAt: null,
        passwordChangeDeadlineAt: null,
      }),
      expect.anything()
    );
  });

  // ── VUL-9: Verificar que changePassword incrementa tokenVersion ──────────────
  it('changePassword incrementa tokenVersion para invalidar tokens existentes', async () => {
    mockAuthRepo.findUserById.mockResolvedValue(buildUser({
      forcePasswordChange: true,
      passwordChangePolicy: 'required',
      tokenVersion: 0,
    }) as any);

    await changePassword('user-1', undefined, 'NewSecure123!');

    expect(mockAuthRepo.updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        tokenVersion: { increment: 1 },
      }),
      expect.anything()
    );
  });
});

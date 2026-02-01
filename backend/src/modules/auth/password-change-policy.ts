import { addHours, addMonths } from 'date-fns';

export const PASSWORD_CHANGE_POLICIES = ['none', 'warning', 'required'] as const;
export type PasswordChangePolicy = (typeof PASSWORD_CHANGE_POLICIES)[number];
export type PasswordChangeState = 'none' | 'warning' | 'required';

export const PASSWORD_CHANGE_WARNING_HOURS = 24;
export const PASSWORD_ROTATION_INTERVAL_MONTHS = 3;

type PasswordChangeCarrier = {
  forcePasswordChange?: boolean | null;
  passwordChangePolicy?: string | null;
  passwordChangeWarnedAt?: Date | null;
  passwordChangeDeadlineAt?: Date | null;
  passwordChangedAt?: Date | null;
};

export function buildRequiredPasswordChangeFields() {
  return {
    forcePasswordChange: true,
    passwordChangePolicy: 'required' as PasswordChangePolicy,
    passwordChangeWarnedAt: null,
    passwordChangeDeadlineAt: null,
  };
}

export function buildWarningPasswordChangeFields(now = new Date(), warningHours = PASSWORD_CHANGE_WARNING_HOURS) {
  return {
    forcePasswordChange: false,
    passwordChangePolicy: 'warning' as PasswordChangePolicy,
    passwordChangeWarnedAt: now,
    passwordChangeDeadlineAt: addHours(now, warningHours),
  };
}

export function buildClearedPasswordChangeFields() {
  return {
    forcePasswordChange: false,
    passwordChangePolicy: 'none' as PasswordChangePolicy,
    passwordChangeWarnedAt: null,
    passwordChangeDeadlineAt: null,
  };
}

export function shouldStartRotationWarning(
  user: PasswordChangeCarrier,
  now = new Date(),
  rotationIntervalMonths = PASSWORD_ROTATION_INTERVAL_MONTHS,
) {
  const policy = normalizePolicy(user.passwordChangePolicy);
  if (policy !== 'none' || user.forcePasswordChange) return false;

  if (!user.passwordChangedAt) return false;
  const nextRotationDate = addMonths(user.passwordChangedAt, rotationIntervalMonths);
  return nextRotationDate.getTime() <= now.getTime();
}

function normalizePolicy(value?: string | null): PasswordChangePolicy {
  if (value === 'warning' || value === 'required') return value;
  return 'none';
}

export function resolvePasswordChangeState(user: PasswordChangeCarrier, now = new Date()): PasswordChangeState {
  const policy = normalizePolicy(user.passwordChangePolicy);

  if (policy === 'required') return 'required';

  if (policy === 'warning') {
    const deadline = user.passwordChangeDeadlineAt;
    if (deadline && deadline.getTime() <= now.getTime()) {
      return 'required';
    }
    return 'warning';
  }

  return user.forcePasswordChange ? 'required' : 'none';
}

export function getPolicyUpgradePatch(user: PasswordChangeCarrier, now = new Date()) {
  const policy = normalizePolicy(user.passwordChangePolicy);
  const resolvedState = resolvePasswordChangeState(user, now);

  if (resolvedState !== 'required') return null;

  if (policy === 'required' && user.forcePasswordChange) {
    return null;
  }

  return buildRequiredPasswordChangeFields();
}

export function getPolicyTransitionPatch(user: PasswordChangeCarrier, now = new Date()) {
  const upgradePatch = getPolicyUpgradePatch(user, now);
  if (upgradePatch) return upgradePatch;

  if (shouldStartRotationWarning(user, now)) {
    return buildWarningPasswordChangeFields(now);
  }

  return null;
}

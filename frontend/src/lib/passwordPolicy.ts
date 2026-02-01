import type { User } from '@/types';

export type PasswordChangeState = 'none' | 'warning' | 'required';

export function resolvePasswordChangeState(user: User | null | undefined, now = new Date()): PasswordChangeState {
  if (!user) return 'none';

  const explicitState = user.passwordChangeState;
  if (explicitState === 'required') return 'required';
  if (explicitState === 'warning') {
    if (user.passwordChangeDeadlineAt) {
      const deadline = new Date(user.passwordChangeDeadlineAt);
      if (!Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime()) {
        return 'required';
      }
    }
    return 'warning';
  }

  const policy = user.passwordChangePolicy;
  if (policy === 'required') return 'required';
  if (policy === 'warning') {
    if (user.passwordChangeDeadlineAt) {
      const deadline = new Date(user.passwordChangeDeadlineAt);
      if (!Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime()) {
        return 'required';
      }
    }
    return 'warning';
  }

  return user.forcePasswordChange ? 'required' : 'none';
}

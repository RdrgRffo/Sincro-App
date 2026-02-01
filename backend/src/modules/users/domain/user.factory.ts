export type NormalizedPhone = string | undefined;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractUsernameFromEmail(email: string): string {
  return email.split('@')[0];
}

export function normalizePhone(phone?: string): NormalizedPhone {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

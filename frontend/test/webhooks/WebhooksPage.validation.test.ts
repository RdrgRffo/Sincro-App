import { describe, it, expect } from 'vitest';
import { webhookFormSchema } from '@/pages/admin/webhooks.schema';

function buildWebhookUrl(totalLength: number): string {
  const base = 'https://example.com/';
  if (totalLength <= base.length) {
    return base.slice(0, totalLength);
  }
  return `${base}${'a'.repeat(totalLength - base.length)}`;
}

const basePayload = {
  name: 'Canal guardias',
  enabled: true,
  notifyModifications: true,
  notifyLastMinute: true,
  fridayReminderEnabled: true,
        mondayAbsenceReminderEnabled: true,
  fridayReminderTime: '12:00',
};

describe('webhookFormSchema', () => {
  it('acepta webhookUrl muy larga (sin límite fijo en frontend)', () => {
    const result = webhookFormSchema.safeParse({
      ...basePayload,
      webhookUrl: buildWebhookUrl(8000),
    });

    expect(result.success).toBe(true);
  });

  it('rechaza webhookUrl con formato inválido', () => {
    const result = webhookFormSchema.safeParse({
      ...basePayload,
      webhookUrl: 'url-invalida',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((entry) => entry.path.join('.') === 'webhookUrl');
      expect(issue?.message).toContain('URL inválida');
    }
  });
});

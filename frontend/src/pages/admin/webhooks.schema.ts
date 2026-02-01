import { z } from 'zod';

export const webhookFormSchema = z.object({
  name: z.string().min(2),
  webhookUrl: z.string().url('URL inválida'),
  enabled: z.boolean(),
  notifyModifications: z.boolean(),
  notifyLastMinute: z.boolean(),
  fridayReminderEnabled: z.boolean(),
  mondayAbsenceReminderEnabled: z.boolean(),
  fridayReminderTime: z.string().default('12:00'),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
});

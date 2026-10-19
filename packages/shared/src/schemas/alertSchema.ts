import { z } from 'zod';

export const CreateAlertSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  targetPrice: z.number().positive('Target price must be positive'),
  condition: z.enum(['ABOVE', 'BELOW', 'PERCENT_CHANGE'])
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;

export const UpdatePreferencesSchema = z.object({
  baseCurrency: z.enum(['USD', 'INR', 'EUR']),
  timezone: z.string().min(2),
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  theme: z.enum(['light', 'dark', 'system'])
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

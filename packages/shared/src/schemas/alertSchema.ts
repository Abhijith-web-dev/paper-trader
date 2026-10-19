import { z } from 'zod';

export const CreateAlertSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  targetPrice: z.number().positive('Target price must be positive'),
  condition: z.enum(['ABOVE', 'BELOW', 'PERCENT_CHANGE'])
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;

export const UpdatePreferencesSchema = z.object({
  country: z.string().optional(),
  baseCurrency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD']),
  preferredExchange: z.string().optional(),
  timezone: z.string().min(2),
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  theme: z.enum(['light', 'dark', 'system'])
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

export const CreateJournalEntrySchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  strategyTag: z.string().min(2, 'Strategy tag is required'),
  entryRationale: z.string().min(5, 'Entry rationale is required'),
  intendedRiskAmount: z.number().nonnegative(),
  targetProfitAmount: z.number().nonnegative(),
  orderId: z.string().optional(),
  postTradeReview: z.string().optional(),
  lessonLearned: z.string().optional()
});

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntrySchema>;

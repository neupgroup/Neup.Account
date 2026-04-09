import { z } from 'zod';

// Generic auth schemas shared across auth flows.
export const registrationSchema = z.object({
  neupId: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
});


/**
 * Schema loginFormSchema.
 */
export const loginFormSchema = z.object({
  neupId: z.string().min(1, 'NeupID is required'),
  password: z.string().min(1, 'Password is required'),
  geolocation: z.string().optional(),
});
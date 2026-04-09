import { z } from 'zod';

/**
 * Schema changePasswordSchema.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});


/**
 * Schema emailFormSchema.
 */
export const emailFormSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});


/**
 * Schema phoneFormSchema.
 */
export const phoneFormSchema = z.object({
  phone: z.string().min(1, 'Phone number cannot be empty.'),
});


/**
 * Schema totpEnableSchema.
 */
export const totpEnableSchema = z.object({
  secret: z.string(),
  token: z.string().length(6, 'Token must be 6 digits.'),
});


/**
 * Schema totpDisableSchema.
 */
export const totpDisableSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});


/**
 * Schema securityQuestionSchema.
 */
export const securityQuestionSchema = z.object({
  question: z.string(),
  answer: z.string(),
});
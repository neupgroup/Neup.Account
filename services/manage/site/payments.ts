'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/core/helpers/prisma';
import { checkPermissions } from '@/core/helpers/user';
import { logError } from '@/core/helpers/logger';

const PAYMENT_CONFIG_DOC_ID = 'site_payment_settings';

const optionalText = z
  .string()
  .trim()
  .max(300, 'Value is too long.')
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const paymentSettingsSchema = z.object({
  providerName: optionalText,
  accountName: optionalText,
  accountNumber: optionalText,
  ifscCode: optionalText,
  upiId: optionalText,
  qrCodeUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || /^https?:\/\//.test(value), {
      message: 'QR Code URL must start with http:// or https://',
    }),
  notes: z
    .string()
    .trim()
    .max(1200, 'Notes can be at most 1200 characters.')
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
});

export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;

const defaultPaymentSettings: PaymentSettings = {
  providerName: undefined,
  accountName: undefined,
  accountNumber: undefined,
  ifscCode: undefined,
  upiId: undefined,
  qrCodeUrl: undefined,
  notes: undefined,
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const canView = await checkPermissions(['root.payment_config.view']);
  if (!canView) return defaultPaymentSettings;

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: PAYMENT_CONFIG_DOC_ID },
    });

    if (!config || !config.data || typeof config.data !== 'object') {
      return defaultPaymentSettings;
    }

    const parsed = paymentSettingsSchema.safeParse(config.data);
    if (!parsed.success) {
      return defaultPaymentSettings;
    }

    return parsed.data;
  } catch (error) {
    await logError('database', error, 'getPaymentSettings');
    return defaultPaymentSettings;
  }
}

export async function updatePaymentSettings(
  formData: FormData,
): Promise<{ success: boolean; error?: string; data?: PaymentSettings }> {
  const canEdit = await checkPermissions(['root.payment_config.view']);
  if (!canEdit) {
    return { success: false, error: 'Permission denied.' };
  }

  const validation = paymentSettingsSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message || 'Invalid payment settings.';
    return { success: false, error: firstError };
  }

  try {
    await prisma.systemConfig.upsert({
      where: { id: PAYMENT_CONFIG_DOC_ID },
      update: { data: validation.data },
      create: {
        id: PAYMENT_CONFIG_DOC_ID,
        data: validation.data,
      },
    });

    revalidatePath('/manage/config');
    revalidatePath('/manage/config/payments');

    return { success: true, data: validation.data };
  } catch (error) {
    await logError('database', error, 'updatePaymentSettings');
    return { success: false, error: 'Failed to save payment settings.' };
  }
}

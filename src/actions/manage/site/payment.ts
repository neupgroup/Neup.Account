 'use server';
 
 import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user';

export type PaymentDetails = {
  qrCodeUrl?: string;
  bankDetails?: string;
  whatsappContact?: string;
  instagramContact?: string;
  linkedinContact?: string;
};

const paymentDetailsSchema = z.object({
  qrCodeUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  bankDetails: z.string().optional(),
  whatsappContact: z.string().optional(),
  instagramContact: z.string().optional(),
  linkedinContact: z.string().url('Please enter a valid LinkedIn URL.').optional().or(z.literal('')),
});

const DOC_ID = 'payment_config';

export async function getPaymentDetails(): Promise<PaymentDetails | null> {
  const canView = await checkPermissions(['root.payment_config.view']);
  if (!canView) return null;

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: DOC_ID }
    });
    return config ? (config.data as PaymentDetails) : null;
  } catch (error) {
    await logError('database', error, 'getPaymentDetails');
    return null;
  }
}

export async function updatePaymentDetails(formData: FormData) {
  const canEdit = await checkPermissions(['root.payment_config.edit']);
  if (!canEdit) {
    return { success: false, error: 'Permission denied.' };
  }

  const data = Object.fromEntries(formData.entries());

  try {
    const validation = paymentDetailsSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        error: 'Validation failed.',
        details: validation.error.flatten().fieldErrors,
      };
    }

    await prisma.systemConfig.upsert({
      where: { id: DOC_ID },
      update: { data: validation.data },
      create: { 
        id: DOC_ID, 
        data: validation.data 
      }
    });

    revalidatePath('/manage/site/payment');
    revalidatePath('/manage/payment/neup.pro');

    return { success: true, message: 'Payment details updated successfully.' };
  } catch (error) {
    await logError('database', error, 'updatePaymentDetails');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
 

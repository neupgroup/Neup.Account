'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkPermissions } from '@/core/helpers/user';
import { logError } from '@/core/helpers/logger';
import { APP_PROFILE_KEYS, readAppProfileData, writeAppProfileData } from '@/services/manage/site/app-profile';

const siteLogoSchema = z.object({
  siteLogoUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || /^https?:\/\//.test(value), {
      message: 'Site Logo URL must start with http:// or https://',
    }),
});

/**
 * Function getSiteLogoUrl.
 */
export async function getSiteLogoUrl(): Promise<string | undefined> {
  try {
    const data = await readAppProfileData<{ siteLogoUrl?: string }>(
      APP_PROFILE_KEYS.siteLogo,
      {},
    );
    const parsed = siteLogoSchema.safeParse(data);
    if (!parsed.success) {
      return undefined;
    }

    return parsed.data.siteLogoUrl;
  } catch (error) {
    await logError('database', error, 'getSiteLogoUrl');
    return undefined;
  }
}


/**
 * Function updateSiteLogoUrl.
 */
export async function updateSiteLogoUrl(
  formData: FormData,
): Promise<{ success: boolean; error?: string; siteLogoUrl?: string }> {
  const canEdit = await checkPermissions(['root.payment_config.view']);
  if (!canEdit) {
    return { success: false, error: 'Permission denied.' };
  }

  const validation = siteLogoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message || 'Invalid logo URL.';
    return { success: false, error: firstError };
  }

  try {
    const success = await writeAppProfileData(APP_PROFILE_KEYS.siteLogo, {
      siteLogoUrl: validation.data.siteLogoUrl,
    });

    if (!success) {
      return { success: false, error: 'Failed to save logo.' };
    }

    revalidatePath('/manage/config');
    revalidatePath('/manage/config/app');
    revalidatePath('/');

    return { success: true, siteLogoUrl: validation.data.siteLogoUrl };
  } catch (error) {
    await logError('database', error, 'updateSiteLogoUrl');
    return { success: false, error: 'Failed to save logo.' };
  }
}

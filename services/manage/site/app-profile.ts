import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

export const APP_PROFILE_KEYS = {
  socials: 'socials',
  payments: 'payments',
  siteLogo: 'siteLogo',
} as const;

export async function readAppProfileData<T>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const row = await prisma.appProfile.findUnique({ where: { key } });
    if (!row || !row.data || typeof row.data !== 'object') {
      return fallback;
    }

    return row.data as T;
  } catch (error) {
    await logError('database', error, `readAppProfileData:${key}`);
    return fallback;
  }
}

export async function writeAppProfileData<T>(
  key: string,
  data: T,
): Promise<boolean> {
  try {
    await prisma.appProfile.upsert({
      where: { key },
      update: { data: data as any },
      create: {
        key,
        data: data as any,
      },
    });

    return true;
  } catch (error) {
    await logError('database', error, `writeAppProfileData:${key}`);
    return false;
  }
}

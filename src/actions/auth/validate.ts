'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getUserProfile, getUserNeupIds } from '@/lib/user';

const ValidateInputSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  key: z.string().min(1),
  accountId: z.string().min(1),
});

export type ValidateInput = z.infer<typeof ValidateInputSchema>;

export type ValidateResult =
  | {
      success: true;
      user: {
        accountId: string;
        displayName: string;
        neupId: string | null;
      };
    }
  | {
      success: false;
      error: string;
      status?: number;
    };

export async function validateExternalRequest(input: ValidateInput): Promise<ValidateResult> {
  const parsed = ValidateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Missing required parameters.', status: 400 };
  }
  const { appId, appSecret, key, accountId } = parsed.data;

  const app = await prisma.application.findUnique({
    where: { id: appId }
  });

  if (!app || app.appSecret !== appSecret) {
    return { success: false, error: 'Invalid application ID or secret.', status: 401 };
  }

  const sessions = await prisma.session.findMany({
    where: {
      accountId,
      isExpired: false,
    },
  });
  if (sessions.length === 0) {
    return { success: false, error: 'No active session found for user.', status: 403 };
  }

  let validKeyFound = false;
  let sessionIdToUpdate: string | null = null;
  let keyIndexToUpdate = -1;
  let dependentKeysToUpdate: any[] = [];

  for (const session of sessions) {
    const dependentKeys = Array.isArray(session.dependentKeys) ? session.dependentKeys : [];
    const keyIndex = dependentKeys.findIndex((k: any) => {
      const expiresOn = new Date(k.expiresOn);
      return k.key === key && k.app === appId && !k.isUsed && expiresOn > new Date();
    });
    if (keyIndex !== -1) {
      validKeyFound = true;
      sessionIdToUpdate = session.id;
      keyIndexToUpdate = keyIndex;
      dependentKeysToUpdate = dependentKeys;
      break;
    }
  }

  if (!validKeyFound || !sessionIdToUpdate) {
    return { success: false, error: 'Invalid or expired key.', status: 403 };
  }

  dependentKeysToUpdate[keyIndexToUpdate].isUsed = true;
  await prisma.session.update({
    where: { id: sessionIdToUpdate },
    data: { dependentKeys: dependentKeysToUpdate },
  });

  const [userProfile, userNeupIds] = await Promise.all([getUserProfile(accountId), getUserNeupIds(accountId)]);
  if (!userProfile) {
    return { success: false, error: 'Could not retrieve user profile.', status: 500 };
  }

  return {
    success: true,
    user: {
      accountId,
      displayName: userProfile?.nameDisplay || `${userProfile?.nameFirst || ''} ${userProfile?.nameLast || ''}`.trim(),
      neupId: userNeupIds[0] || null,
    },
  };
}


'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getUserProfile, getUserNeupIds } from '@/lib/user';

const ValidateInputSchema = z.object({
  appId: z.string().min(1),
  appType: z.enum(['internal', 'external', 'fast']).optional(),
  // External Auth Params
  appSecret: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  // Internal/Fast Auth Params
  auth_account_id: z.string().min(1).optional(),
  auth_session_id: z.string().min(1).optional(),
  auth_session_key: z.string().min(1).optional(),
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
  const { 
    appId, 
    appType, 
    appSecret, 
    key, 
    accountId, 
    auth_account_id, 
    auth_session_id, 
    auth_session_key 
  } = parsed.data;

  // 1. App Validation
  const app = await prisma.application.findUnique({
    where: { id: appId }
  });

  if (!app) {
    return { success: false, error: 'Invalid application ID.', status: 404 };
  }

  // 2. Handle Internal or Fast Application Validation
  if (appType === 'internal' || appType === 'fast') {
    if (!auth_account_id || !auth_session_id || !auth_session_key) {
      return { success: false, error: 'Missing authentication parameters.', status: 400 };
    }

    const session = await prisma.session.findUnique({
      where: { id: auth_session_id },
    });

    if (
      !session ||
      session.accountId !== auth_account_id ||
      session.authSessionKey !== auth_session_key ||
      session.isExpired ||
      !session.expiresOn ||
      session.expiresOn < new Date()
    ) {
      return { success: false, error: 'Invalid or expired session.', status: 401 };
    }

    // Fast check: return only success if appType is 'fast'
    if (appType === 'fast') {
      return {
        success: true,
        user: {
          accountId: auth_account_id,
          displayName: '', // Not needed for fast check
          neupId: null,    // Not needed for fast check
        },
      };
    }

    const [userProfile, userNeupIds] = await Promise.all([
      getUserProfile(auth_account_id), 
      getUserNeupIds(auth_account_id)
    ]);

    if (!userProfile) {
      return { success: false, error: 'Could not retrieve user profile.', status: 500 };
    }

    return {
      success: true,
      user: {
        accountId: auth_account_id,
        displayName: userProfile?.nameDisplay || `${userProfile?.nameFirst || ''} ${userProfile?.nameLast || ''} `.trim(),
        neupId: userNeupIds[0] || null,
      },
    };
  }

  // 3. Handle External Application Validation (Default)
  if (!appSecret || !key || !accountId) {
    return { success: false, error: 'Missing external authentication parameters.', status: 400 };
  }

  if (app.appSecret !== appSecret) {
    return { success: false, error: 'Invalid application secret.', status: 401 };
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


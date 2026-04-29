'use server';

import { getActiveAccountId, getPersonalAccountId } from '@/core/helpers/auth-actions';
import { getUserProfile, getUserPermissions } from '@/core/helpers/user';
import { verifyActiveSession } from '@/services/auth/verify';
import type { StoredProfileInfo } from './storage';

export type SessionCheckResult =
    | { valid: false }
    | {
          valid: true;
          profileInfo: StoredProfileInfo;
          permissions: string[];
          accountId: string;
          personalAccountId: string;
      };

export async function checkSession(): Promise<SessionCheckResult> {
    const verification = await verifyActiveSession();
    if (!verification.valid) {
        return { valid: false };
    }

    const [activeId, personalId] = await Promise.all([
        getActiveAccountId(),
        getPersonalAccountId(),
    ]);

    if (!activeId || !personalId) {
        return { valid: false };
    }

    const [profile, permissions] = await Promise.all([
        getUserProfile(activeId),
        getUserPermissions(activeId),
    ]);

    if (!profile) {
        return { valid: false };
    }

    return {
        valid: true,
        profileInfo: {
            firstName: profile.nameFirst,
            lastName: profile.nameLast,
            neupId: profile.neupIdPrimary,
            accountType: profile.accountType,
        },
        permissions,
        accountId: activeId,
        personalAccountId: personalId,
    };
}

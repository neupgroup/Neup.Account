'use server';

import { getActiveAccountId, getPersonalAccountId } from '@/core/helpers/auth-actions';
import { getUserProfile } from '@/core/helpers/user';
import { getEncodedUserPermissions } from '@/core/helpers/user';
import { verifyActiveSession } from '@/services/auth/verify';
import type { StoredProfileInfo } from './storage';

export type SessionCheckResult =
    | { valid: false }
    | {
          valid: true;
          profileInfo: StoredProfileInfo;
          encodedPermissions: string;
          accountId: string;
          personalAccountId: string;
      };

/**
 * Authoritative session check. Verifies the session against the DB,
 * then returns fresh profile info and encoded permissions.
 * The client compares these against its cached values and updates if changed.
 */
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

    const [profile, encodedPerms] = await Promise.all([
        getUserProfile(activeId),
        getEncodedUserPermissions(activeId),
    ]);

    if (!profile) {
        return { valid: false };
    }

    const profileInfo: StoredProfileInfo = {
        firstName: profile.nameFirst,
        lastName: profile.nameLast,
        neupId: profile.neupIdPrimary,
        accountType: profile.accountType,
    };

    return {
        valid: true,
        profileInfo,
        encodedPermissions: encodedPerms.encoded,
        accountId: activeId,
        personalAccountId: personalId,
    };
}

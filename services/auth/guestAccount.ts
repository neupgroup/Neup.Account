'use server';

import { cookies } from 'next/headers';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { COOKIE_GUEST_ACC } from '@/core/auth/constants';

const GUEST_COOKIE_MAX_AGE_YEARS = 1;

/**
 * Resolves or creates a guest account for the current browser.
 *
 * The `guest_acc` cookie stores the guest account ID. A guest account is a
 * real Account row with accountType = 'guest'. It acts as the anonymous
 * identity for the device before (and after) the user signs in.
 *
 * Login behaviour (linkedAccountId provided):
 *   - Guest account created < 30 days ago → link it to the real account
 *     by setting linkedAccountId on the guest account
 *   - Guest account created ≥ 30 days ago → expire the guest account
 *     (set status = 'expired'), create a new guest account linked to the
 *     real account
 *
 * Logout behaviour:
 *   - The existing guest account is expired
 *   - A new unlinked guest account is created for the device
 *
 * No cookie → create a new guest account and set the cookie.
 * Expired guest account in cookie → create a new one.
 *
 * @param linkedAccountId - The real account to link to. Pass null for
 *                          anonymous/logout scenarios.
 */
export async function resolveGuestAccount(
  linkedAccountId: string | null = null
): Promise<void> {
  try {
    const cookieStore = await cookies();
    const existingGuestId = cookieStore.get(COOKIE_GUEST_ACC)?.value ?? null;

    let guestAccountId: string;

    if (existingGuestId) {
      const existing = await prisma.account.findUnique({
        where: { id: existingGuestId },
        select: { id: true, accountType: true, status: true, createdAt: true, linkedAccountId: true },
      });

      const isValidGuest = existing && existing.accountType === 'guest' && existing.status !== 'expired';

      if (isValidGuest) {
        if (linkedAccountId) {
          // Authenticated — check age
          const ageMs = Date.now() - existing.createdAt.getTime();
          const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

          if (ageMs < ONE_MONTH_MS) {
            // Fresh guest — link to real account if not already linked
            if (!existing.linkedAccountId) {
              await prisma.account.update({
                where: { id: existingGuestId },
                data: { linkedAccountId },
              });
            }
            guestAccountId = existingGuestId;
          } else {
            // Stale guest — expire it and create a new one linked to the account
            await prisma.account.update({
              where: { id: existingGuestId },
              data: { status: 'expired' },
            });
            const newGuest = await prisma.account.create({
              data: { accountType: 'guest', linkedAccountId },
            });
            guestAccountId = newGuest.id;
          }
        } else {
          // Anonymous — reuse as-is
          guestAccountId = existingGuestId;
        }
      } else {
        // Cookie points to a non-existent or expired guest — create a new one
        const newGuest = await prisma.account.create({
          data: { accountType: 'guest', linkedAccountId },
        });
        guestAccountId = newGuest.id;
      }
    } else {
      // No cookie — create a new guest account
      const newGuest = await prisma.account.create({
        data: { accountType: 'guest', linkedAccountId },
      });
      guestAccountId = newGuest.id;
    }

    // Set/refresh the guest_acc cookie
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + GUEST_COOKIE_MAX_AGE_YEARS);

    cookieStore.set(COOKIE_GUEST_ACC, guestAccountId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
  } catch (error) {
    await logError('auth', error, 'resolve_guest_account');
  }
}

/**
 * Expires the current guest account on logout and creates a new anonymous one.
 * Called from logoutActiveSession.
 */
export async function rotateGuestAccountOnLogout(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const currentGuestId = cookieStore.get(COOKIE_GUEST_ACC)?.value ?? null;

    // Expire the current guest account
    if (currentGuestId) {
      await prisma.account.updateMany({
        where: { id: currentGuestId, accountType: 'guest' },
        data: { status: 'expired' },
      });
    }

    // Create a new anonymous guest account for this device
    const newGuest = await prisma.account.create({
      data: { accountType: 'guest' },
    });

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    cookieStore.set(COOKIE_GUEST_ACC, newGuest.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
  } catch (error) {
    await logError('auth', error, 'rotate_guest_account_on_logout');
  }
}

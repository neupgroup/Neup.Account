
'use server';

import { z } from "zod";
import { getActiveAccountId } from "@/core/helpers/auth-actions";
import { logActivity } from "@/core/helpers/log-actions";
import { logError } from "@/core/helpers/logger";
import prisma from "@/core/helpers/prisma";
import bcrypt from "bcryptjs";
import { checkPermissions } from "@/core/helpers/user";
import { logoutActiveSession } from "../auth/signout";

const formSchema = z.object({
    password: z.string().min(1, "Password is required to request deletion."),
});

/**
 * Function requestAccountDeletion.
 */
export async function requestAccountDeletion(data: z.infer<typeof formSchema>, geolocation?: string): Promise<{ success: boolean; error?: string; }> {
  const canDelete = await checkPermissions(['data.delete_account.start']);
  if (!canDelete) {
    return { success: false, error: "You do not have permission to delete this account." };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: "User not authenticated." };
  }

  const validation = formSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: validation.error.flatten().fieldErrors.password?.[0] };
  }
  const { password } = validation.data;

  try {
    const [account, authData] = await Promise.all([
        prisma.account.findUnique({ where: { id: accountId } }),
        prisma.password.findUnique({ where: { accountId } })
    ]);
    
    if (account && account.accountStatus === 'deletion_requested') {
        return { success: false, error: "Your account is already scheduled for deletion." };
    }

    if (!authData) {
        await logActivity(accountId, 'Account Deletion Request Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "Authentication data not found." };
    }
    const isMatch = await bcrypt.compare(password, authData.hash);
    if (!isMatch) {
        await logActivity(accountId, 'Account Deletion Request Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "The password you entered is incorrect." };
    }
    
    await prisma.$transaction([
        // Update the status in the account document
        prisma.account.update({
            where: { id: accountId },
            data: { accountStatus: 'deletion_requested' }
        }),
        // Create a log in the new account_status collection
        prisma.accountStatusLog.create({
            data: {
                accountId: accountId,
                status: 'deletion_requested',
                remarks: 'User initiated deletion request.',
                fromDate: new Date(),
                moreInfo: 'User verified password to request deletion.'
            }
        })
    ]);

    await logActivity(accountId, "Account Deletion Requested", "Success", undefined, undefined, geolocation);
    await logoutActiveSession();

    return { success: true };

  } catch (error) {
    await logError("database", error, `requestAccountDeletion: ${accountId}`);
    return { success: false, error: "An unexpected error occurred." };
  }
}


/**
 * Function cancelAccountDeletion.
 */
export async function cancelAccountDeletion(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.account.update({
            where: { id: accountId },
            data: { accountStatus: 'active' }
        });

        await logActivity(accountId, "Account Deletion Cancelled", "Success");
        return { success: true };
    } catch (error) {
        await logError('database', error, `cancelAccountDeletion: ${accountId}`);
        return { success: false, error: "Failed to cancel account deletion." };
    }
}

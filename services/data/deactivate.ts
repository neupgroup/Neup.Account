'use server';

import { z } from "zod";
import { logActivity } from "@/core/helpers/log-actions";
import { logError } from "@/core/helpers/logger";
import prisma from "@/core/helpers/prisma";
import bcrypt from "bcryptjs";
import { checkPermissions } from "@/core/helpers/user";
import { getActiveAccountId } from "@/core/helpers/auth-actions";
import { logoutActiveSession } from "../auth/signout";

const formSchema = z.object({
    password: z.string().min(1, "Password is required to deactivate your account."),
});


/**
 * Function deactivateAccount.
 */
export async function deactivateAccount(data: z.infer<typeof formSchema>, geolocation?: string): Promise<{ success: boolean; error?: string; }> {
  const canDeactivate = await checkPermissions(['data.deactivate_account.start']);
  if (!canDeactivate) {
    return { success: false, error: "You do not have permission to deactivate this account." };
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
    const authData = await prisma.password.findUnique({
        where: { accountId }
    });

    if (!authData) {
        await logActivity(accountId, 'Deactivation Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "Authentication data not found." };
    }
    const isMatch = await bcrypt.compare(password, authData.hash);
    if (!isMatch) {
        await logActivity(accountId, 'Deactivation Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "The password you entered is incorrect." };
    }

    // In a real application, you would set a 'deactivated' flag on the user's account.
    await prisma.account.update({
        where: { id: accountId },
      data: { status: 'deactivated' }
    });
    await logActivity(accountId, "Account Deactivated", "Success", undefined, undefined, geolocation);
    
    // The most important part of deactivation is ending the current session.
    await logoutActiveSession();
    
    console.log(`Account deactivated for accountId: ${accountId}. User has been logged out.`);
    return { success: true };

  } catch (error) {
    await logError("database", error, `deactivateAccount: ${accountId}`);
    return { success: false, error: "An unexpected error occurred." };
  }
}

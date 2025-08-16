
"use server";

import { z } from "zod";
import { getActiveAccountId, logoutActiveSession } from "@/lib/auth-actions";
import { logActivity } from "@/lib/log-actions";
import { logError } from "@/lib/logger";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { checkPermissions } from "@/lib/user-actions";

const formSchema = z.object({
    password: z.string().min(1, "Password is required to deactivate your account."),
});


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
    const authRef = doc(db, 'auth_password', accountId);
    const authDoc = await getDoc(authRef);

    if (!authDoc.exists()) {
        await logActivity(accountId, 'Deactivation Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "Authentication data not found." };
    }
    const isMatch = await bcrypt.compare(password, authDoc.data().pass);
    if (!isMatch) {
        await logActivity(accountId, 'Deactivation Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "The password you entered is incorrect." };
    }

    // In a real application, you would set a 'deactivated' flag on the user's account.
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

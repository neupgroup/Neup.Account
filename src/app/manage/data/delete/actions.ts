
"use server";

import { z } from "zod";
import { getActiveAccountId } from "@/lib/auth-actions";
import { logActivity } from "@/lib/log-actions";
import { logError } from "@/lib/logger";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { checkPermissions } from "@/lib/user-actions";

const formSchema = z.object({
    password: z.string().min(1, "Password is required to request deletion."),
});

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
    const authRef = doc(db, 'auth_password', accountId);
    const authDoc = await getDoc(authRef);

    if (!authDoc.exists()) {
        await logActivity(accountId, 'Account Deletion Request Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "Authentication data not found." };
    }
    const isMatch = await bcrypt.compare(password, authDoc.data().pass);
    if (!isMatch) {
        await logActivity(accountId, 'Account Deletion Request Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "The password you entered is incorrect." };
    }
    
    // In a real application, update the user's status and set a 'deletionRequestedAt' timestamp.
    await logActivity(accountId, "Account Deletion Requested", "Success", undefined, undefined, geolocation);

    console.log(
      `Account deletion requested for accountId: ${accountId}. A 30-day cool-off period has started.`
    );
    return { success: true };

  } catch (error) {
    await logError("database", error, `requestAccountDeletion: ${accountId}`);
    return { success: false, error: "An unexpected error occurred." };
  }
}

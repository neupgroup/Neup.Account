'use server';

import { z } from "zod";
import { getActiveAccountId } from "@/lib/auth-actions";
import { logActivity } from "@/lib/log-actions";
import { logError } from "@/lib/logger";
import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, collection, serverTimestamp, updateDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";
import { checkPermissions } from "@/lib/user";
import { logoutActiveSession } from "../auth/signout";

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
    const accountRef = doc(db, 'account', accountId);
    const authRef = doc(db, 'auth_password', accountId);
    
    const [accountDoc, authDoc] = await Promise.all([
        getDoc(accountRef),
        getDoc(authRef)
    ]);
    
    if (accountDoc.exists() && accountDoc.data().status === 'deletion_requested') {
        return { success: false, error: "Your account is already scheduled for deletion." };
    }

    if (!authDoc.exists()) {
        await logActivity(accountId, 'Account Deletion Request Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "Authentication data not found." };
    }
    const isMatch = await bcrypt.compare(password, authDoc.data().pass);
    if (!isMatch) {
        await logActivity(accountId, 'Account Deletion Request Failed', 'Failed', undefined, undefined, geolocation);
        return { success: false, error: "The password you entered is incorrect." };
    }
    
    const batch = writeBatch(db);

    // Update the status in the account document
    batch.update(accountRef, { status: 'deletion_requested' });

    // Create a log in the new account_status collection
    const statusLogRef = doc(collection(db, 'account_status'));
    batch.set(statusLogRef, {
        account_id: accountId,
        status: 'deletion_requested',
        remarks: 'User initiated deletion request.',
        from_date: serverTimestamp(),
        more_info: 'User verified password to request deletion.'
    });

    await batch.commit();

    await logActivity(accountId, "Account Deletion Requested", "Success", undefined, undefined, geolocation);
    await logoutActiveSession();

    return { success: true };

  } catch (error) {
    await logError("database", error, `requestAccountDeletion: ${accountId}`);
    return { success: false, error: "An unexpected error occurred." };
  }
}


export async function cancelAccountDeletion(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const accountRef = doc(db, 'account', accountId);
        await updateDoc(accountRef, { status: 'active' });

        await logActivity(accountId, "Account Deletion Cancelled", "Success");
        return { success: true };
    } catch (error) {
        await logError('database', error, `cancelAccountDeletion: ${accountId}`);
        return { success: false, error: "Failed to cancel account deletion." };
    }
}

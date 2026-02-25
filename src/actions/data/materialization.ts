'use server';

import { z } from "zod";
import { getActiveAccountId } from "@/lib/auth-actions";
import { logActivity } from "@/lib/log-actions";
import { logError } from "@/lib/logger";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkPermissions } from "@/lib/user";

const formSchema = z.object({
    inactivityDays: z.string().min(1, "Please select a time period."),
    password: z.string().min(1, "Password is required to schedule deletion."),
});


export async function scheduleMaterialization(data: z.infer<typeof formSchema>, geolocation?: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['data.materialization.modify']);
    if (!canModify) {
        return { success: false, error: "Permission denied." };
    }

    const accountId = await getActiveAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = formSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided." };
    }
    const { inactivityDays, password } = validation.data;

    try {
        const authData = await prisma.password.findUnique({
            where: { accountId }
        });

        if (!authData) {
            await logActivity(accountId, 'Materialization Schedule Failed', 'Failed', undefined, undefined, geolocation);
            return { success: false, error: "Authentication data not found." };
        }
        const isMatch = await bcrypt.compare(password, authData.hash);
        if (!isMatch) {
            await logActivity(accountId, 'Materialization Schedule Failed', 'Failed', undefined, undefined, geolocation);
            return { success: false, error: "The password you entered is incorrect." };
        }
        
        // In a real application, you would store this preference in the database.
        // For now we'll just log it as per original logic, but we could add it to Account model if needed.
        await logActivity(accountId, `Scheduled Materialization for ${inactivityDays} days`, "Success", undefined, undefined, geolocation);

        console.log(
        `Materialization scheduled for accountId: ${accountId} after ${inactivityDays} days of inactivity.`
        );
        return { success: true };

    } catch (error) {
        await logError("database", error, `scheduleMaterialization: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}



'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getActiveAccountId, getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { checkPermissions } from '@/lib/user-actions';

const formSchema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    isLegalEntity: z.boolean().default(false),
    legalName: z.string().optional(),
    registrationId: z.string().optional(),
    hasHeadOffice: z.boolean().default(false),
    headOfficeLocation: z.string().optional(),
    servingAreas: z.string().optional(),
    neupId: z.string()
        .min(3, "NeupID must be at least 3 characters.")
        .regex(/^[a-z0-9-]+$/, "NeupID can only contain lowercase letters, numbers, and hyphens."),
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must accept the terms and conditions.",
    }),
}).superRefine((data, ctx) => {
    if (data.isLegalEntity && !data.legalName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Legal name is required for legal entities.", path: ["legalName"] });
    }
    if (data.hasHeadOffice && !data.headOfficeLocation) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Head office location is required.", path: ["headOfficeLocation"] });
    }
});

export async function createBrandAccount(data: z.infer<typeof formSchema>, geolocation?: string) {
    const canCreate = await checkPermissions(['linked_accounts.brand.create']);
    if (!canCreate) {
        return { success: false, error: "You do not have permission to create a brand account." };
    }
    
    const creatorAccountId = await getActiveAccountId();
    if (!creatorAccountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = formSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { fullName, legalName, registrationId, headOfficeLocation, servingAreas } = validation.data;
    const neupId = validation.data.neupId.toLowerCase();
    const ipAddress = headers().get('x-forwarded-for') || 'Unknown IP';

    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', neupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        const batch = writeBatch(db);

        const newAccountRef = doc(collection(db, 'account'));
        const brandAccountId = newAccountRef.id;

        batch.set(newAccountRef, {
            type: 'brand',
            managedBy: [creatorAccountId]
        });

        const newNeupIdRef = doc(db, 'neupid', neupId);
        batch.set(newNeupIdRef, { for: brandAccountId, is_primary: true });

        batch.set(doc(db, "profile", brandAccountId), {
            displayName: fullName,
            legalName: legalName || null,
            registrationId: registrationId || null,
            servingAreas: servingAreas || null,
            createdAt: serverTimestamp(),
        });
        
        if (headOfficeLocation) {
             const newContactRef = doc(collection(db, 'contact'));
             batch.set(newContactRef, {
                account_id: brandAccountId,
                contact_type: 'headOfficeLocation',
                value: headOfficeLocation
            });
        }
        
        await batch.commit();
        
        const personalAccountId = await getPersonalAccountId();
        await logActivity(creatorAccountId, `Created Brand Account: ${neupId}`, 'Success', ipAddress, personalAccountId || undefined, geolocation);
        revalidatePath('/manage/brand');

        return { success: true };

    } catch (error) {
        await logError('database', error, 'createBrandAccount');
        return { success: false, error: 'An unexpected error occurred during brand account creation.' };
    }
}

export async function checkNeupIdAvailability(neupId: string): Promise<{ available: boolean }> {
    const lowerNeupId = neupId.toLowerCase();
    if (!lowerNeupId || lowerNeupId.length < 3) {
        return { available: false };
    }
    try {
        const neupidsRef = collection(db, 'neupid');
        const docRef = doc(neupidsRef, lowerNeupId);
        const docSnap = await getDoc(docRef);
        return { available: !docSnap.exists() };
    } catch (error) {
        await logError('database', error, `checkNeupIdAvailability: ${lowerNeupId}`);
        // To be safe, report as unavailable on error
        return { available: false };
    }
}

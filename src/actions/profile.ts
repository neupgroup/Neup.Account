
'use server';

import { z } from "zod"
import { db } from "@/lib/firebase"
import { doc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, getDoc } from "firebase/firestore"
import { parseDate as parseDateWithAI } from "@/ai/flows/parse-date"
import { logActivity } from "@/lib/log-actions"
import { logError } from "@/lib/logger"
import { checkPermissions, getUserNeupIds, checkNeupIdAvailability } from "@/lib/user"
import { getPersonalAccountId } from "@/lib/auth-actions";
import { brandProfileFormSchema } from "@/schemas/profile"


async function updateOrCreateContact(batch: ReturnType<typeof writeBatch>, accountId: string, type: string, value: string | undefined, hasPermission: boolean) {
    if (!hasPermission) return;

    const contactsRef = collection(db, 'contact');
    const q = query(contactsRef, where('account_id', '==', accountId), where('contact_type', '==', type));
    const snapshot = await getDocs(q);

    if (value && value.trim().length > 0) {
        if (snapshot.empty) {
            // Create new contact
            const newContactRef = doc(contactsRef);
            batch.set(newContactRef, {
                account_id: accountId,
                contact_type: type,
                value: value
            });
        } else {
            // Update existing contact
            const existingDocRef = snapshot.docs[0].ref;
            batch.update(existingDocRef, { value: value });
        }
    } else {
        // Delete contact if value is empty/undefined
        if (!snapshot.empty) {
            const existingDocRef = snapshot.docs[0].ref;
            batch.delete(existingDocRef);
        }
    }
}


export async function updateUserProfile(accountId: string, data: Record<string, any>, geolocation?: string) {
    const [canModifyProfile, canModifyContact, canModifyNeupId] = await Promise.all([
        checkPermissions(['profile.modify']),
        checkPermissions(['contact.modify', 'contact.add', 'contact.remove']),
        checkPermissions(['profile.neupid.add']),
    ]);

    if (!canModifyProfile && !canModifyContact && !canModifyNeupId) {
         return { success: false, error: "You do not have permission to update this profile." }
    }

    if (!accountId) {
        return { success: false, error: "User not authenticated." }
    }

    try {
        const batch = writeBatch(db);

        if (canModifyProfile) {
            const profileData: Record<string, any> = {};

            // List of valid profile fields to prevent unwanted data being written
            const validProfileFields = ['firstName', 'middleName', 'lastName', 'displayName', 'displayPhoto', 'gender', 'dob'];
            for(const key of validProfileFields) {
                if(data[key] !== undefined) {
                    profileData[key] = data[key];
                }
            }

            if (profileData.dob instanceof Date) {
              profileData.dob = profileData.dob.toISOString();
            }
            
            if(Object.keys(profileData).length > 0) {
                const profileRef = doc(db, 'profile', accountId);
                batch.update(profileRef, profileData);
            }
        }
        
        if (canModifyNeupId && data.newNeupIdRequest && data.newNeupIdRequest.trim().length > 0) {
            const { available } = await checkNeupIdAvailability(data.newNeupIdRequest);
            if (!available) {
                return { success: false, error: "The requested NeupID is already taken." };
            }
            
            const accountDoc = await getDoc(doc(db, 'account', accountId));
            const accountData = accountDoc.data();
            const existingNeupIds = await getUserNeupIds(accountId);
            
            const isPro = accountData?.pro === true;
            const limit = isPro ? 2 : 1;

            if (existingNeupIds.length >= limit) {
                return { success: false, error: `You have reached the limit of ${limit} NeupID(s) for your account.` };
            }

            const requestsRef = collection(db, 'requests');
            const newRequestRef = doc(requestsRef);
            const requestedNeupId = data.newNeupIdRequest.toLowerCase();
            const requesterId = await getPersonalAccountId();

            batch.set(newRequestRef, {
                action: 'neupid_request',
                accountId: accountId,
                requestedNeupId: requestedNeupId,
                status: 'pending',
                createdAt: serverTimestamp(),
                requestor: requesterId,
            });
            await logActivity(accountId, `Requested New NeupID: ${requestedNeupId}`, 'Pending', undefined, geolocation);
        }

        await updateOrCreateContact(batch, accountId, 'primaryPhone', data.primaryPhone, canModifyContact);
        await updateOrCreateContact(batch, accountId, 'secondaryPhone', data.secondaryPhone, canModifyContact);
        await updateOrCreateContact(batch, accountId, 'permanentLocation', data.permanentLocation, canModifyContact);
        await updateOrCreateContact(batch, accountId, 'currentLocation', data.currentLocation, canModifyContact);
        await updateOrCreateContact(batch, accountId, 'workLocation', data.workLocation, canModifyContact);
        await updateOrCreateContact(batch, accountId, 'otherLocation', data.otherLocation, canModifyContact);

        await batch.commit();
        
        await logActivity(accountId, 'Profile Update', 'Success', undefined, undefined, geolocation);
        
        return { success: true, message: "Profile updated successfully." }
    } catch (error) {
        await logError('database', error, `updateUserProfile: ${accountId}`);
        if (error instanceof z.ZodError) {
            return { success: false, error: "Validation failed.", details: error.flatten() }
        }
        return { success: false, error: "An unexpected error occurred." }
    }
}

export async function updateBrandProfile(accountId: string, data: z.infer<typeof brandProfileFormSchema>, geolocation?: string) {
    if (!accountId) {
        return { success: false, error: "Brand account not authenticated." };
    }

    try {
        const validatedData = brandProfileFormSchema.parse(data);
        const profileRef = doc(db, 'profile', accountId);
        
        const dataToUpdate: Partial<any> = {
            displayName: validatedData.displayName,
            displayPhoto: validatedData.displayPhoto,
            isLegalEntity: validatedData.isLegalEntity,
        };

        if (validatedData.isLegalEntity) {
            dataToUpdate.legalName = validatedData.legalName;
            dataToUpdate.registrationId = validatedData.registrationId;
            dataToUpdate.countryOfOrigin = validatedData.countryOfOrigin;
            dataToUpdate.registeredOn = validatedData.registeredOn?.toISOString();
        } else {
            dataToUpdate.legalName = null;
            dataToUpdate.registrationId = null;
            dataToUpdate.countryOfOrigin = null;
            dataToUpdate.registeredOn = null;
        }

        await updateDoc(profileRef, dataToUpdate);

        await logActivity(accountId, 'Brand Profile Update', 'Success', undefined, undefined, geolocation);

        return { success: true, message: "Brand profile updated successfully." };

    } catch (error) {
        await logError('database', error, `updateBrandProfile: ${accountId}`);
        if (error instanceof z.ZodError) {
            return { success: false, error: "Validation failed.", details: error.flatten() };
        }
        return { success: false, error: "An unexpected error occurred while updating the brand profile." };
    }
}


export async function parseDateString(dateString: string): Promise<{ success: boolean; date: string | null; error?: string }> {
    if (dateString.length > 30) {
        return { success: false, date: null, error: "Date input is too long (max 30 characters)." };
    }

    // Attempt local parsing first for YYYY-MM-DD or YYYY/MM/DD
    const regex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
    const match = dateString.match(regex);
    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                 return { success: true, date: d.toISOString().split('T')[0] };
            }
        }
    }

    // If local parsing fails, call AI
    try {
        const result = await parseDateWithAI(dateString);
        if (result.parsedDate !== 'invalid') {
            const d = new Date(result.parsedDate + 'T00:00:00');
            if (!isNaN(d.getTime())) {
                return { success: true, date: result.parsedDate };
            }
        }
        return { success: false, date: null, error: "Invalid date format." };
    } catch (error) {
        await logError('ai', error, `parseDateString: ${dateString}`);
        return { success: false, date: null, error: "Could not parse date. The AI service may be unavailable." };
    }
}

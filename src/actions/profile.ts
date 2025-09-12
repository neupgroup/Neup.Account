

'use server';

import { z } from "zod"
import { db } from "@/lib/firebase"
import { doc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, getDoc, orderBy, limit } from "firebase/firestore"
import { parseDate as parseDateWithAI } from "@/ai/flows/parse-date"
import { logActivity } from "@/lib/log-actions"
import { logError } from "@/lib/logger"
import { checkPermissions, getUserNeupIds, checkNeupIdAvailability, getUserProfile as fetchUserProfile } from "@/lib/user"
import { getPersonalAccountId } from "@/lib/auth-actions";
import { brandProfileFormSchema } from "@/schemas/auth"


export async function getDisplayNameSuggestions(accountId: string): Promise<string[]> {
    const profile = await fetchUserProfile(accountId);
    if (!profile) return [];

    const { nameFirst, nameMiddle, nameLast } = profile;
    const suggestions = new Set<string>();

    if (nameFirst) {
        suggestions.add(nameFirst);
    }
    if (nameFirst && nameMiddle) {
        suggestions.add(`${nameFirst} ${nameMiddle}`);
    }
    if (nameFirst && nameLast) {
        suggestions.add(`${nameFirst} ${nameLast}`);
        suggestions.add(`${nameLast} ${nameFirst}`);
    }
    if (nameFirst && nameMiddle && nameLast) {
        suggestions.add(`${nameFirst} ${nameMiddle} ${nameLast}`);
        suggestions.add(`${nameLast} ${nameMiddle} ${nameFirst}`);
    }
    
    return Array.from(suggestions);
}

export async function getPastProfilePhotos(accountId: string): Promise<string[]> {
    try {
        const contentRef = collection(db, 'usercontent');
        const q = query(
            contentRef,
            where('forAccountId', '==', accountId),
            where('platform', '==', 'neup.account'),
            orderBy('uploadedAt', 'desc'),
            limit(4) // Fetch the 4 most recent profile pictures
        );
        const querySnapshot = await getDocs(q);
        const urls = querySnapshot.docs.map(doc => doc.data().url);
        return urls;
    } catch (error) {
        await logError('database', error, `getPastProfilePhotos for ${accountId}`);
        return [];
    }
}


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
        const accountRef = doc(db, 'account', accountId);

        if (canModifyProfile) {
            const accountData: Record<string, any> = {};

            // List of valid profile fields to prevent unwanted data being written
            const validAccountFields = ['nameFirst', 'nameMiddle', 'nameLast', 'gender', 'customGender', 'dateBirth', 'nameDisplay', 'accountPhoto'];
            for(const key of validAccountFields) {
                if(data[key] !== undefined) {
                    accountData[key] = data[key];
                }
            }
            
            // Auto-update display name if legal name changes
            const hasNameChange = ['nameFirst', 'nameMiddle', 'nameLast'].some(key => data[key] !== undefined);
            if (hasNameChange) {
                const currentProfile = await fetchUserProfile(accountId);
                const newFirstName = data.nameFirst ?? currentProfile?.nameFirst;
                const newMiddleName = data.nameMiddle ?? currentProfile?.nameMiddle;
                const newLastName = data.nameLast ?? currentProfile?.nameLast;
                
                let defaultDisplayName = `${newFirstName || ''} ${newLastName || ''}`.trim();
                if (newMiddleName) {
                    defaultDisplayName = `${newFirstName || ''} ${newMiddleName} ${newLastName || ''}`.trim();
                }
                 accountData.nameDisplay = defaultDisplayName;
            }


            if (accountData.dateBirth instanceof Date) {
              accountData.dateBirth = accountData.dateBirth.toISOString();
            }
            
            if (data.customDisplayNameRequest) {
                 const requestsRef = collection(db, 'requests');
                 const requesterId = await getPersonalAccountId();

                 // Cancel previous pending requests from the same user
                 const q = query(requestsRef, where('action', '==', 'display_name_request'), where('accountId', '==', accountId), where('status', '==', 'pending'));
                 const oldRequests = await getDocs(q);
                 oldRequests.forEach(doc => {
                    batch.update(doc.ref, { status: 'cancelled', remarks: 'Superseded by new request.' });
                 });
                 
                 // Create new request
                 const newRequestRef = doc(requestsRef);
                 batch.set(newRequestRef, {
                    action: 'display_name_request',
                    accountId: accountId,
                    requestedDisplayName: data.customDisplayNameRequest,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    requestor: requesterId,
                });
                await logActivity(accountId, `Requested Custom Display Name: ${data.customDisplayNameRequest}`, 'Pending', undefined, geolocation);
                // Don't update the nameDisplay in the profile directly
                delete accountData.nameDisplay;
            }

            if(Object.keys(accountData).length > 0) {
                batch.update(accountRef, accountData);
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
        
        await logActivity(accountId, 'Profile Update', 'Success', undefined, geolocation);
        
        const message = data.customDisplayNameRequest 
            ? "Your display name request has been submitted for review."
            : "Profile updated successfully.";

        return { success: true, message }
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
        const accountRef = doc(db, 'account', accountId);
        
        // Data for the 'account' collection
        const accountDataToUpdate: Partial<any> = {
            nameDisplay: validatedData.nameDisplay,
            accountPhoto: validatedData.accountPhoto,
            isLegalEntity: validatedData.isLegalEntity,
        };

        if (validatedData.isLegalEntity) {
            accountDataToUpdate.nameLegal = validatedData.nameLegal;
            accountDataToUpdate.registrationId = validatedData.registrationId;
            accountDataToUpdate.countryOfOrigin = validatedData.countryOfOrigin;
            accountDataToUpdate.dateEstablished = validatedData.dateEstablished?.toISOString();
        } else {
            accountDataToUpdate.nameLegal = null;
            accountDataToUpdate.registrationId = null;
            accountDataToUpdate.countryOfOrigin = null;
            accountDataToUpdate.dateEstablished = null;
        }

        await updateDoc(accountRef, accountDataToUpdate);

        await logActivity(accountId, 'Brand Profile Update', 'Success', undefined, geolocation);

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

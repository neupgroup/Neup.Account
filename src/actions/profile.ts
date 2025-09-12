

'use server';

import { z } from "zod"
import { db } from "@/lib/firebase"
import { doc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, getDoc, orderBy, limit } from "firebase/firestore"
import { parseDate as parseDateWithAI } from "@/ai/flows/parse-date"
import { logActivity } from "@/lib/log-actions"
import { logError } from "@/lib/logger"
import { checkPermissions, getUserNeupIds, checkNeupIdAvailability, getUserProfile as fetchUserProfile } from "@/lib/user"
import { getPersonalAccountId } from "@/lib/auth-actions";
import { brandProfileFormSchema } from "@/schemas/profile"


export async function getDisplayNameSuggestions(accountId: string): Promise<string[]> {
    const profile = await fetchUserProfile(accountId);
    if (!profile) return [];

    const { firstName, middleName, lastName } = profile;
    const suggestions = new Set<string>();

    if (firstName) {
        suggestions.add(firstName);
    }
    
    if (firstName && lastName) {
        suggestions.add(`${firstName} ${lastName}`);
        suggestions.add(`${lastName} ${firstName}`);
    }

    if (firstName && middleName) {
        suggestions.add(`${firstName} ${middleName}`);
    }
    
    if (firstName && middleName && lastName) {
        suggestions.add(`${firstName} ${middleName} ${lastName}`);
        suggestions.add(`${lastName} ${middleName} ${firstName}`);
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
        const profileRef = doc(db, 'profile', accountId);

        if (canModifyProfile) {
            const profileData: Record<string, any> = {};
            const accountData: Record<string, any> = {};

            // List of valid profile fields to prevent unwanted data being written
            const validProfileFields = ['firstName', 'middleName', 'lastName', 'gender', 'dob'];
            for(const key of validProfileFields) {
                if(data[key] !== undefined) {
                    profileData[key] = data[key];
                }
            }
            
            // Handle displayName and displayPhoto which are now on the account doc
            if(data.displayName !== undefined) accountData.displayName = data.displayName;
            if(data.displayPhoto !== undefined) accountData.displayPhoto = data.displayPhoto;


            // Auto-update display name if legal name changes
            const hasNameChange = ['firstName', 'middleName', 'lastName'].some(key => data[key] !== undefined);
            if (hasNameChange) {
                const currentProfile = await fetchUserProfile(accountId);
                const newFirstName = data.firstName ?? currentProfile?.firstName;
                const newMiddleName = data.middleName ?? currentProfile?.middleName;
                const newLastName = data.lastName ?? currentProfile?.lastName;
                
                let defaultDisplayName = `${newFirstName || ''} ${newLastName || ''}`.trim();
                if (newMiddleName) {
                    defaultDisplayName = `${newFirstName || ''} ${newMiddleName} ${newLastName || ''}`.trim();
                }
                 accountData.displayName = defaultDisplayName;
            }


            if (profileData.dob instanceof Date) {
              profileData.dob = profileData.dob.toISOString();
            }
            
            if (data.customDisplayNameRequest) {
                 const requestsRef = collection(db, 'requests');
                 const newRequestRef = doc(requestsRef);
                 const requesterId = await getPersonalAccountId();
                 batch.set(newRequestRef, {
                    action: 'display_name_request',
                    accountId: accountId,
                    requestedDisplayName: data.customDisplayNameRequest,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    requestor: requesterId,
                });
                await logActivity(accountId, `Requested Custom Display Name: ${data.customDisplayNameRequest}`, 'Pending', undefined, geolocation);
                // Don't update the displayName in the profile directly
                delete accountData.displayName;
            }

            if(Object.keys(profileData).length > 0) {
                batch.update(profileRef, profileData);
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
        const profileRef = doc(db, 'profile', accountId);
        const batch = writeBatch(db);
        
        // Data for the 'account' collection
        const accountDataToUpdate: Partial<any> = {
            displayName: validatedData.displayName,
            displayPhoto: validatedData.displayPhoto,
        };

        // Data for the 'profile' collection
        const profileDataToUpdate: Partial<any> = {
            isLegalEntity: validatedData.isLegalEntity,
        };

        if (validatedData.isLegalEntity) {
            profileDataToUpdate.legalName = validatedData.legalName;
            profileDataToUpdate.registrationId = validatedData.registrationId;
            profileDataToUpdate.countryOfOrigin = validatedData.countryOfOrigin;
            profileDataToUpdate.registeredOn = validatedData.registeredOn?.toISOString();
        } else {
            profileDataToUpdate.legalName = null;
            profileDataToUpdate.registrationId = null;
            profileDataToUpdate.countryOfOrigin = null;
            profileDataToUpdate.registeredOn = null;
        }

        batch.update(accountRef, accountDataToUpdate);
        batch.update(profileRef, profileDataToUpdate);

        await batch.commit();

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

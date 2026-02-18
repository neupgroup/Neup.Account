'use server';

import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { brandProfileFormSchema } from '@/schemas/auth';
import { getUserProfile, checkPermissions, checkNeupIdAvailability, getUserNeupIds } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { parseDate } from '@/ai/flows/parse-date';


export async function getDisplayNameSuggestions(accountId: string): Promise<string[]> {
    const profile = await getUserProfile(accountId);
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
            limit(4)
        );
        const querySnapshot = await getDocs(q);
        const urls = querySnapshot.docs.map((docSnap) => (docSnap.data() as any).url as string);
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
            const newContactRef = doc(contactsRef);
            batch.set(newContactRef, {
                account_id: accountId,
                contact_type: type,
                value: value
            });
        } else {
            const existingDocRef = snapshot.docs[0].ref;
            batch.update(existingDocRef, { value: value });
        }
    } else {
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
            const validAccountFields = ['nameFirst', 'nameMiddle', 'nameLast', 'gender', 'customGender', 'dateBirth', 'nameDisplay', 'accountPhoto'];
            for(const key of validAccountFields) {
                if(data[key] !== undefined) {
                    accountData[key] = data[key];
                }
            }

            const hasNameChange = ['nameFirst', 'nameMiddle', 'nameLast'].some(key => data[key] !== undefined);
            if (hasNameChange) {
                const currentProfile = await getUserProfile(accountId);
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

                 const q = query(
                    requestsRef,
                    where('action', '==', 'display_name_request'),
                    where('accountId', '==', accountId),
                    where('status', '==', 'pending')
                 );
                 const oldRequests = await getDocs(q);
                 oldRequests.forEach((docSnap) => {
                    batch.update(docSnap.ref, { status: 'cancelled', remarks: 'Superseded by new request.' });
                 });
                 
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

export async function updateBrandProfile(accountId: string, data: z.infer<typeof brandProfileFormSchema>, locationString?: string) {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = brandProfileFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    try {
        const accountRef = doc(db, 'account', accountId);
        const updateData: any = {
            ...validation.data,
            updatedAt: serverTimestamp(),
        };

        if (locationString) {
            updateData.lastLocation = locationString;
        }

        await updateDoc(accountRef, updateData);
        revalidatePath('/manage/profile');
        
        return { success: true, message: "Brand profile updated successfully." };
    } catch (error) {
        await logError('database', error, 'updateBrandProfile');
        return { success: false, error: 'An unexpected error occurred while updating your profile.' };
    }
}


export async function parseDateString(dateString: string): Promise<{ success: boolean; date: string | null; error?: string }> {
    if (dateString.length > 30) {
        return { success: false, date: null, error: "Date input is too long (max 30 characters)." };
    }

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

    try {
        const result = await parseDate(dateString);
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
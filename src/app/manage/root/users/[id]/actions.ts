

'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, writeBatch, serverTimestamp, addDoc, orderBy, limit, arrayUnion } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { type UserProfile, getUserProfile, checkPermissions } from '@/lib/user-actions';
import { logActivity } from '@/lib/log-actions';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { z } from 'zod';


export type UserDetails = {
    accountId: string;
    neupId: string;
    profile: UserProfile;
};

export type AccountDetails = {
    block: {
        status: boolean;
        reason?: string;
        message?: string;
        is_permanent?: boolean;
        until?: string | null;
    } | null;
}

export type UserActivityLog = {
    id: string;
    action: string;
    status: string;
    ip: string;
    timestamp: string;
    geolocation?: string;
    rawTimestamp: Date;
}

export type UserPermissions = {
    assignedPermissionSets: string[];
    allPermissions: string[];
}

export type UserDashboardStats = {
    lastIpAddress: string;
    lastLocation: string;
    lastActive: string;
}

export async function getUserDetails(neupId: string): Promise<UserDetails | null> {
    const canView = await checkPermissions(['root.account.view_full', 'root.account.view_limited1', 'root.account.view_limited2']);
    if (!canView) return null;

    try {
        const lowerNeupId = neupId.toLowerCase();
        const neupidRef = doc(db, 'neupid', lowerNeupId);
        const neupidDoc = await getDoc(neupidRef);
        
        if (!neupidDoc.exists()) {
            return null;
        }
        
        const accountId = neupidDoc.data().for;
        const profile = await getUserProfile(accountId);

        if (!profile) {
            return null;
        }

        return {
            accountId,
            neupId: lowerNeupId,
            profile,
        };
    } catch (error) {
        await logError('database', error, `getUserDetails for neupId: ${neupId}`);
        return null;
    }
}

export async function getUserDashboardStats(accountId: string): Promise<UserDashboardStats> {
    const fallback = { lastIpAddress: 'N/A', lastLocation: 'N/A', lastActive: 'N/A' };
    const canView = await checkPermissions(['root.account.view_full']);
    if (!canView) return fallback;

    try {
        const activityRef = collection(db, 'activity');

        // Query for the most recent activity overall
        const lastActivityQuery = query(
            activityRef, 
            where('targetAccountId', '==', accountId), 
            orderBy('timestamp', 'desc'), 
            limit(1)
        );

        // Query for the most recent activity that has a geolocation
        const lastLocationQuery = query(
            activityRef,
            where('targetAccountId', '==', accountId),
            where('geolocation', '!=', null),
            orderBy('geolocation'), // Firestore requires this for the inequality
            orderBy('timestamp', 'desc'),
            limit(1)
        );

        const [lastActivitySnapshot, lastLocationSnapshot] = await Promise.all([
            getDocs(lastActivityQuery),
            getDocs(lastLocationQuery)
        ]);

        if (lastActivitySnapshot.empty) {
            return fallback;
        }

        const lastActivity = lastActivitySnapshot.docs[0].data();
        const lastLocation = !lastLocationSnapshot.empty ? lastLocationSnapshot.docs[0].data().geolocation : 'Unknown';

        return {
            lastIpAddress: lastActivity.ip || 'N/A',
            lastLocation: lastLocation,
            lastActive: lastActivity.timestamp?.toDate().toLocaleString() || 'N/A',
        };

    } catch (error) {
        await logError('database', error, `getUserDashboardStats for ${accountId}`);
        return fallback;
    }
}


export async function getAccountDetails(neupId: string): Promise<AccountDetails | null> {
    const canView = await checkPermissions(['root.account.view_full']);
    if (!canView) return null;
    try {
        const userDetails = await getUserDetails(neupId);
        if (!userDetails) return null;

        const accountRef = doc(db, 'account', userDetails.accountId);
        const accountDoc = await getDoc(accountRef);

        if (!accountDoc.exists()) return null;

        const data = accountDoc.data();
        const blockData = data.block || null;
        
        if (blockData && blockData.until) {
            blockData.until = blockData.until.toDate().toISOString();
        }

        return {
            block: blockData,
        };
    } catch(error) {
         await logError('database', error, `getAccountDetails for neupId: ${neupId}`);
        return null;
    }
}

export async function getActivity(neupId: string): Promise<Omit<UserActivityLog, 'rawTimestamp'>[]> {
    const canView = await checkPermissions(['root.account.view_activity']);
    if (!canView) return [];

    try {
        const userDetails = await getUserDetails(neupId);
        if (!userDetails) return [];

        const activityRef = collection(db, 'activity');
        // Query only by targetAccountId to avoid needing a composite index.
        const q = query(activityRef, where('targetAccountId', '==', userDetails.accountId));
        const querySnapshot = await getDocs(q);

        const activities: UserActivityLog[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate() || new Date();
            return {
                id: doc.id,
                action: data.action,
                status: data.status,
                ip: data.ip,
                timestamp: timestamp.toLocaleString(),
                geolocation: data.geolocation,
                rawTimestamp: timestamp,
            };
        });

        // Sort in code and take the last 10.
        activities.sort((a, b) => b.rawTimestamp.getTime() - a.rawTimestamp.getTime());
        const recentActivities = activities.slice(0, 10);
        
        // Remove the rawTimestamp before returning to the client.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return recentActivities.map(({ rawTimestamp, ...rest }) => rest);

    } catch(error) {
        await logError('database', error, `getActivity for neupId: ${neupId}`);
        return [];
    }
}

export async function getPermissions(neupId: string): Promise<UserPermissions> {
    const fallback: UserPermissions = { assignedPermissionSets: [], allPermissions: [] };
    const canView = await checkPermissions(['root.account.view_full']);
    if (!canView) return fallback;

    try {
        const userDetails = await getUserDetails(neupId);
        if (!userDetails) return fallback;

        // Fetch assigned permission sets
        const permitRef = collection(db, 'permit');
        const q = query(permitRef, where('account_id', '==', userDetails.accountId), where('is_root', '==', true));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
             return { assignedPermissionSets: ['standard_user'], allPermissions: [] }; // Default
        }
        
        const permitData = querySnapshot.docs[0].data();
        const assignedIds = permitData.permission || [];
        
        const allPermissionSetsQuery = await getDocs(collection(db, 'permission'));
        const permissionSetMap = new Map(allPermissionSetsQuery.docs.map(d => [d.id, d.data().name]));

        return { 
            assignedPermissionSets: assignedIds.map((id: string) => permissionSetMap.get(id) || id),
            allPermissions: [], // This will be populated on the client from the main list
        };

    } catch (error) {
        await logError('database', error, `getPermissions for neupId: ${neupId}`);
        return fallback;
    }
}


// --- Administrative Actions ---
const sendWarningSchema = z.object({
    message: z.string().min(1, "Message cannot be empty"),
    reason: z.string().min(1, "Reason cannot be empty"),
    noticeType: z.enum(['general', 'success', 'warning', 'error']),
    persistence: z.enum(['dismissable', 'untildays', 'permanent']),
    days: z.number().optional(),
});

export async function sendWarning(userId: string, data: z.infer<typeof sendWarningSchema>): Promise<{success: boolean, error?: string}> {
    const canWarn = await checkPermissions(['root.account.send_warning']);
    if (!canWarn) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const validation = sendWarningSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data submitted." };
    }

    const { message, reason, noticeType, persistence, days } = validation.data;
    
    let expiresOn: string | null = null;
    if (persistence === 'untildays' && days) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        expiresOn = expiryDate.toISOString();
    }

    try {
        const accountRef = doc(db, 'account', userId);
        const newWarning = {
            message,
            persistence,
            issuedBy: adminId,
            issuedOn: new Date().toISOString(),
            reason,
            expiresOn,
            noticeType
        };

        await updateDoc(accountRef, {
            warnings: arrayUnion(newWarning)
        });

        await logActivity(userId, `Admin sent warning: "${message}"`, 'Alert', undefined, adminId);
        return { success: true };
    } catch (error) {
        await logError('database', error, 'sendWarning');
        return { success: false, error: 'Could not send warning.' };
    }
}

const blockServiceSchema = z.object({
    isPermanent: z.boolean(),
    durationInHours: z.number().optional(),
    reason: z.string().min(1, "Reason is required"),
    message: z.string().min(1, "Message is required"),
});

export async function blockServiceAccess(userId: string, data: z.infer<typeof blockServiceSchema>): Promise<{success: boolean, error?: string}> {
    const canBlock = await checkPermissions(['root.account.give_block_account']);
    if (!canBlock) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const validation = blockServiceSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid data submitted.' };
    }
    
    const { isPermanent, durationInHours, reason, message } = validation.data;
    
    try {
        const accountRef = doc(db, 'account', userId);
        
        let until = null;
        if (!isPermanent && durationInHours) {
            const date = new Date();
            date.setHours(date.getHours() + durationInHours);
            until = date;
        }

        const blockData = {
            status: true,
            reason,
            message,
            is_permanent: isPermanent,
            until: until,
        };

        await updateDoc(accountRef, { block: blockData });
        await logActivity(userId, `Service access blocked. Reason: ${reason}`, 'Alert', undefined, adminId);
        return { success: true };
    } catch (error) {
        await logError('database', error, 'blockServiceAccess');
        return { success: false, error: 'Could not block service access.' };
    }
}


export async function unblockServiceAccess(userId: string): Promise<{success: boolean, error?: string}> {
    const canUnblock = await checkPermissions(['root.account.remove_block_account']);
    if (!canUnblock) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

     try {
        const accountRef = doc(db, 'account', userId);
        await updateDoc(accountRef, { block: null });
        await logActivity(userId, `Service access unblocked`, 'Success', undefined, adminId);
        return { success: true };
    } catch (error) {
        await logError('database', error, 'unblockServiceAccess');
        return { success: false, error: 'Could not unblock service access.' };
    }
}

export async function impersonateUser(userId: string, neupId: string): Promise<{success: boolean, error?: string}> {
    const canImpersonate = await checkPermissions(['root.account.impersonate']);
    if (!canImpersonate) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const headersList = headers();
        const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
        const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

        const expiresOn = new Date();
        expiresOn.setHours(expiresOn.getHours() + 1); // 1 hour impersonation
        const sessionKey = crypto.randomUUID();

        const newSessionDocRef = await addDoc(collection(db, 'session'), {
            accountId: userId,
            auth_session_key: sessionKey,
            ipAddress: ipAddress,
            userAgent: userAgent,
            isExpired: false,
            expiresOn: serverTimestamp(),
            lastLoggedIn: serverTimestamp(),
            loginType: 'Impersonation',
        });
        
        const cookieStore = cookies();
        const cookieOptions = { path: '/', expires: expiresOn, sameSite: 'lax' as const, secure: true, httpOnly: true };

        cookieStore.set('auth_account_id', userId, cookieOptions);
        cookieStore.set('auth_session_id', newSessionDocRef.id, cookieOptions);
        cookieStore.set('auth_session_key', sessionKey, cookieOptions);
        
        await logActivity(userId, `Admin impersonation started by ${adminId}`, 'Alert', undefined, adminId);

        return { success: true };
    } catch(error) {
        await logError('database', error, `impersonateUser: ${userId}`);
        return { success: false, error: 'Could not start impersonation session.' };
    }
}

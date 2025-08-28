'use server';

import { db } from '@/lib/firebase';
import { doc, collection, query, where, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { getActiveAccountId, getActiveSession } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';

export type UserSession = {
    id: string;
    ipAddress: string;
    userAgent: string;
    lastLoggedIn: string;
    loginType: string;
    geolocation?: string;
    rawLastLoggedIn: Date;
};

export async function getUserSessions(): Promise<UserSession[]> {
    const accountId = await getActiveAccountId();
    if (!accountId) {
        return [];
    }

    try {
        const sessionsRef = collection(db, 'session');
        const q = query(sessionsRef, where('accountId', '==', accountId), where('isExpired', '==', false));
        const querySnapshot = await getDocs(q);
        
        type SessionInternal = UserSession & { rawLastLoggedIn: Date };

        const sessions: SessionInternal[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const lastLoggedInDate = data.lastLoggedIn?.toDate() || new Date();
            return {
                id: doc.id,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                lastLoggedIn: lastLoggedInDate.toLocaleString(),
                loginType: data.loginType,
                geolocation: data.geolocation,
                rawLastLoggedIn: lastLoggedInDate
            };
        });

        sessions.sort((a, b) => b.rawLastLoggedIn.getTime() - a.rawLastLoggedIn.getTime());
        
        return sessions;
        
    } catch (error) {
        await logError('database', error, `getUserSessions: ${accountId}`);
        return [];
    }
}


export async function logoutSessionById(sessionId: string): Promise<{ success: boolean, error?: string }> {
    if (!sessionId) {
        return { success: false, error: "Session ID is required." };
    }
    try {
        const sessionRef = doc(db, 'session', sessionId);
        await updateDoc(sessionRef, { isExpired: true });
        
        const accountId = await getActiveAccountId();
        if (accountId) {
            await logActivity(accountId, `Remote Logout of Session ${sessionId}`, 'Success');
        }

        return { success: true };
    } catch (error) {
        await logError('database', error, `logoutSessionById: ${sessionId}`);
        return { success: false, error: "Failed to log out session." };
    }
}

export async function logoutAllOtherSessions(): Promise<{ success: boolean, error?: string }> {
    const currentSession = await getActiveSession();
    if (!currentSession) {
        return { success: false, error: "No active session found." };
    }
    const { accountId, sessionId: currentSessionId } = currentSession;

    try {
        const sessionsRef = collection(db, 'session');
        const q = query(sessionsRef, where('accountId', '==', accountId), where('isExpired', '==', false));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: true }; 
        }

        const batch = writeBatch(db);
        let sessionsLoggedOut = 0;

        querySnapshot.docs.forEach(sessionDoc => {
            if (sessionDoc.id !== currentSessionId) {
                batch.update(sessionDoc.ref, { isExpired: true });
                sessionsLoggedOut++;
            }
        });

        if (sessionsLoggedOut > 0) {
            await batch.commit();
            await logActivity(accountId, `Remotely logged out of ${sessionsLoggedOut} other sessions.`, 'Success');
        }

        return { success: true };
    } catch (error) {
        await logError('database', error, 'logoutAllOtherSessions');
        return { success: false, error: "Failed to log out other sessions." };
    }
}

'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { checkPermissions } from '@/lib/user';
import { logError } from '@/lib/logger';
import type { Application } from '@/types';

type ConnectedApplications = {
    firstParty: Application[];
    thirdParty: Application[];
};

// Fetches applications the user is connected to.
export async function getConnectedApplications(): Promise<ConnectedApplications> {
    const canView = await checkPermissions(['security.third_party.view']);
    if (!canView) {
        return { firstParty: [], thirdParty: [] };
    }
    
    const accountId = await getPersonalAccountId();
    if (!accountId) {
        return { firstParty: [], thirdParty: [] };
    }

    try {
        // Step 1: Find all app connections for the user
        const connectionsRef = collection(db, 'user_app_connections');
        const connectionsQuery = query(connectionsRef, where('accountId', '==', accountId));
        const connectionsSnapshot = await getDocs(connectionsQuery);

        if (connectionsSnapshot.empty) {
            return { firstParty: [], thirdParty: [] };
        }

        const appIds = connectionsSnapshot.docs.map(doc => doc.data().appId);
        
        if (appIds.length === 0) {
            return { firstParty: [], thirdParty: [] };
        }

        // Step 2: Fetch details for those apps
        const appsRef = collection(db, 'applications');
        const appsQuery = query(appsRef, where('__name__', 'in', appIds));
        const appsSnapshot = await getDocs(appsQuery);

        const allApps: Application[] = appsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Application));

        // Step 3: Categorize apps
        const firstParty = allApps.filter(app => app.party === 'first');
        const thirdParty = allApps.filter(app => app.party === 'third');

        return { firstParty, thirdParty };

    } catch (error) {
        await logError('database', error, 'getConnectedApplications');
        return { firstParty: [], thirdParty: [] };
    }
}

// Fetches details for a single application by its ID.
export async function getApplicationDetails(appId: string): Promise<Application | null> {
    const canView = await checkPermissions(['security.third_party.view']);
    if (!canView) {
        return null;
    }
    
    try {
        const appRef = doc(db, 'applications', appId);
        const appDoc = await getDoc(appRef);

        if (appDoc.exists()) {
            return {
                id: appDoc.id,
                ...appDoc.data()
            } as Application;
        }

        return null;
    } catch (error) {
        await logError('database', error, `getApplicationDetails: ${appId}`);
        return null;
    }
}

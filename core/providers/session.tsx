"use client";

import { createContext, useState, useEffect, type ReactNode, useContext } from 'react';
import { type UserProfile, getUserProfile as fetchUserProfile } from '@/core/helpers/user';
import { getActiveAccountId, getPersonalAccountId } from '@/core/auth/actions';
import { checkSession } from '@/core/auth/check';
import {
    getSessionData,
    setSessionData,
    deleteSessionData,
    PROFILE_INFO_KEY,
    JWT_KEY,
} from '@/core/auth/storage';

type SessionState = {
    loading: boolean;
    profile: UserProfile | null;
    permissions: string[] | null;
    accountId: string | null;
    personalAccountId: string | null;
    isManaging: boolean;
    refetch: () => void;
};

const SessionContext = createContext<SessionState | undefined>(undefined);

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}

export const SessionProvider = ({ children }: { children: ReactNode }) => {
    const [sessionState, setSessionState] = useState<SessionState>({
        loading: true,
        profile: null,
        permissions: null,
        accountId: null,
        personalAccountId: null,
        isManaging: false,
        refetch: () => {},
    });

    const fetchData = async (forceRefresh = false) => {
        setSessionState(s => ({ ...s, loading: true }));

        const result = await checkSession();

        if (!result.valid) {
            deleteSessionData();
            setSessionState(s => ({ ...s, loading: false, profile: null, permissions: [] }));
            return;
        }

        // Update profileInfo in sessionStorage if changed
        const cachedProfile = getSessionData(PROFILE_INFO_KEY);
        const profileChanged = !cachedProfile ||
            cachedProfile.firstName !== result.profileInfo.firstName ||
            cachedProfile.lastName !== result.profileInfo.lastName ||
            cachedProfile.neupId !== result.profileInfo.neupId ||
            cachedProfile.accountType !== result.profileInfo.accountType;

        if (profileChanged) {
            setSessionData(PROFILE_INFO_KEY, result.profileInfo);
        }

        // Update permissions in sessionStorage (stored as JSON in jwt key) if changed
        const cachedPermissions = getSessionData(JWT_KEY);
        const freshPermissionsJson = JSON.stringify(result.permissions);
        if (cachedPermissions !== freshPermissionsJson) {
            setSessionData(JWT_KEY, freshPermissionsJson);
        }

        // Fetch full profile for UI only if needed
        let fullProfile: UserProfile | null = sessionState.profile;
        if (forceRefresh || profileChanged || !fullProfile) {
            fullProfile = await fetchUserProfile(result.accountId);
        }

        setSessionState({
            loading: false,
            profile: fullProfile,
            permissions: result.permissions,
            accountId: result.accountId,
            personalAccountId: result.personalAccountId,
            isManaging: result.accountId !== result.personalAccountId,
            refetch: () => fetchData(true),
        });
    };

    const clearCacheAndRefetch = () => {
        deleteSessionData();
        fetchData(true);
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SessionContext.Provider value={{ ...sessionState, refetch: clearCacheAndRefetch }}>
            {children}
        </SessionContext.Provider>
    );
};

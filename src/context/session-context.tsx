
"use client";

import { createContext, useState, useEffect, type ReactNode, useContext } from 'react';
import { type UserProfile, getUserNeupIds, getUserPermissions, getUserProfile as fetchUserProfile } from '@/lib/user';
import { getActiveAccountId, getPersonalAccountId, validateCurrentSession } from '@/lib/auth-actions';

type SessionState = {
    loading: boolean;
    profile: (UserProfile & { neupId?: string }) | null;
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

const SESSION_STORAGE_KEY = 'neup-session-cache';

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
        // Always set loading to true when fetching
        setSessionState(s => ({ ...s, loading: true }));

        // On initial load, try to load from sessionStorage
        if (!forceRefresh && typeof window !== 'undefined') {
            const cachedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (cachedData) {
                try {
                    const parsedData = JSON.parse(cachedData);
                    // A simple validation to ensure the cached data has what we need
                    if (parsedData.profile && parsedData.permissions && parsedData.accountId) {
                        setSessionState({ ...parsedData, loading: false, refetch: () => fetchData(true) });
                        return;
                    }
                } catch (e) {
                    // Cached data is invalid, clear it
                    sessionStorage.removeItem(SESSION_STORAGE_KEY);
                }
            }
        }
        
        try {
            // Validate server-side session cookies. Redirects on failure.
            await validateCurrentSession();

            const [activeId, personalId] = await Promise.all([
                getActiveAccountId(),
                getPersonalAccountId()
            ]);
            
            if (!activeId || !personalId) {
                setSessionState(s => ({ ...s, loading: false, profile: null, permissions: [] }));
                return;
            }

            const [profile, neupIds, permissions] = await Promise.all([
                fetchUserProfile(activeId),
                getUserNeupIds(activeId),
                getUserPermissions(activeId)
            ]);
            
            const sessionProfile = profile ? { ...profile, neupId: neupIds[0] } : null;

            const newState = {
                loading: false,
                profile: sessionProfile,
                permissions,
                accountId: activeId,
                personalAccountId: personalId,
                isManaging: activeId !== personalId,
            };

            setSessionState({ ...newState, refetch: () => fetchData(true) });
            
            // Save the new state to sessionStorage on the client
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newState));
            }

        } catch (error) {
            // Errors during session validation (like redirection) will be caught here.
            // We just stop the loading process.
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
    };

    const clearCacheAndRefetch = () => {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
        fetchData(true);
    };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <SessionContext.Provider value={{...sessionState, refetch: clearCacheAndRefetch}}>
            {children}
        </SessionContext.Provider>
    );
};

"use client";

import { createContext, useState, useEffect, type ReactNode, useContext } from 'react';
import { type UserProfile, getUserProfile as fetchUserProfile } from '@/core/helpers/user';
import { getActiveAccountId, getPersonalAccountId } from '@/core/helpers/auth-actions';
import { checkSession } from '@/core/auth/session-check';
import {
    getStoredProfileInfo,
    setStoredProfileInfo,
    getStoredJwt,
    setStoredJwt,
    clearAuthStorage,
    type StoredProfileInfo,
} from '@/core/auth/storage';

type SessionState = {
    loading: boolean;
    profile: UserProfile | null;
    permissions: string[] | null;
    accountId: string | null;
    personalAccountId: string | null;
    isManaging: boolean;
    encodedPermissions?: string;
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

// PINNED PUBLIC KEY
const PINNED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1MRyZBxfprhH/PfgUtst
JwKTNubWb9pyPTuSRnS8x2J/DJ+5L785UT2Q48wD2a8vAr5gFKVvq2bhnv3qPopk
Y+KkcKQZyGlAoDLzFzOaDRH4t0KhA68+FVJKRGzwUbj1lDepxB5q28ChisKHdiDU
JDQGgGLFf4rG2x1lmr0MNzncW7F3EvaR42Y2QWuzZXnNF6YN+XRisp8cVmR+NdZL
6f0bNpyGsr13IIDvFyZxcKC/c0EhGcKn729+w2CMun30wgfN+DqtFSAj9Q3oQC6c
BqpzKC8u7hkvWQ1sUJPDVJUfANayYpFDqBzIjmUJKhPK+oOxxfFmAbt1wZd09zAq
qwIDAQAB
-----END PUBLIC KEY-----`;

async function decodeAndVerifyPermissions(encoded: string): Promise<string[]> {
    const outerPayload = JSON.parse(atob(encoded));
    const { data: dataBase64, signature: signatureBase64 } = outerPayload;

    const data = atob(dataBase64);
    const dataBuffer = new TextEncoder().encode(data);
    const signatureBuffer = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = PINNED_PUBLIC_KEY.substring(
        PINNED_PUBLIC_KEY.indexOf(pemHeader) + pemHeader.length,
        PINNED_PUBLIC_KEY.indexOf(pemFooter)
    ).replace(/\s/g, "");

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const publicKey = await window.crypto.subtle.importKey(
        "spki",
        binaryKey.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
    );

    const isValid = await window.crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        signatureBuffer,
        dataBuffer
    );

    if (!isValid) {
        throw new Error("TAMPER_DETECTED");
    }

    return JSON.parse(data);
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

        // Always verify session against DB first — catches remote logouts
        const result = await checkSession();

        if (!result.valid) {
            clearAuthStorage();
            setSessionState(s => ({ ...s, loading: false, profile: null, permissions: [] }));
            return;
        }

        // Check if cached profileInfo is still valid, update if changed
        const cachedProfile = getStoredProfileInfo();
        const freshProfile = result.profileInfo;
        const profileChanged = !cachedProfile ||
            cachedProfile.firstName !== freshProfile.firstName ||
            cachedProfile.lastName !== freshProfile.lastName ||
            cachedProfile.neupId !== freshProfile.neupId ||
            cachedProfile.accountType !== freshProfile.accountType;

        if (profileChanged) {
            setStoredProfileInfo(freshProfile);
        }

        // Check if permissions changed, update jwt if so
        const cachedJwt = getStoredJwt();
        const freshEncoded = result.encodedPermissions;
        const permissionsChanged = !cachedJwt || cachedJwt !== freshEncoded;

        if (permissionsChanged) {
            setStoredJwt(freshEncoded);
        }

        // Decode and verify permissions
        let permissions: string[] = [];
        try {
            permissions = await decodeAndVerifyPermissions(freshEncoded);
        } catch {
            clearAuthStorage();
            setSessionState(s => ({ ...s, loading: false, profile: null, permissions: [] }));
            return;
        }

        // Fetch full profile for UI (only if forced or profile changed)
        let fullProfile: UserProfile | null = null;
        if (forceRefresh || profileChanged || !sessionState.profile) {
            fullProfile = await fetchUserProfile(result.accountId);
        } else {
            fullProfile = sessionState.profile;
        }

        setSessionState({
            loading: false,
            profile: fullProfile,
            permissions,
            accountId: result.accountId,
            personalAccountId: result.personalAccountId,
            isManaging: result.accountId !== result.personalAccountId,
            encodedPermissions: freshEncoded,
            refetch: () => fetchData(true),
        });
    };

    const clearCacheAndRefetch = () => {
        clearAuthStorage();
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

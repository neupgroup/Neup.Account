"use client";

import { createContext, useState, useEffect, type ReactNode, useContext } from 'react';
import { type UserProfile, getEncodedUserPermissions, getUserProfile as fetchUserProfile } from '@/lib/user';
import { getActiveAccountId, getPersonalAccountId } from '@/lib/auth-actions';

type SessionState = {
    loading: boolean;
    profile: UserProfile | null;
    permissions: string[] | null;
    accountId: string | null;
    personalAccountId: string | null;
    isManaging: boolean;
    encodedPermissions?: string; // Store the original signed payload
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
const PUBLIC_KEY_STORAGE_KEY = 'neup-session-pubkey';

// PINNED PUBLIC KEY
// This is the only key the application trusts for verifying permissions.
// Even if a user swaps the key in sessionStorage, the application will use this pinned key.
const PINNED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1MRyZBxfprhH/PfgUtst
JwKTNubWb9pyPTuSRnS8x2J/DJ+5L785UT2Q48wD2a8vAr5gFKVvq2bhnv3qPopk
Y+KkcKQZyGlAoDLzFzOaDRH4t0KhA68+FVJKRGzwUbj1lDepxB5q28ChisKHdiDU
JDQGgGLFf4rG2x1lmr0MNzncW7F3EvaR42Y2QWuzZXnNF6YN+XRisp8cVmR+NdZL
6f0bNpyGsr13IIDvFyZxcKC/c0EhGcKn729+w2CMun30wgfN+DqtFSAj9Q3oQC6c
BqpzKC8u7hkvWQ1sUJPDVJUfANayYpFDqBzIjmUJKhPK+oOxxfFmAbt1wZd09zAq
qwIDAQAB
-----END PUBLIC KEY-----`;

// Helper to decode permissions using the pinned public key and verify signature
// This fulfills the requirement that users cannot forge their own permissions.
async function decodeAndVerifyPermissions(encoded: string): Promise<string[]> {
    try {
        // 1. Decode the outer envelope
        const outerPayload = JSON.parse(atob(encoded));
        const { data: dataBase64, signature: signatureBase64 } = outerPayload;
        
        // 2. Prepare for verification
        const data = atob(dataBase64);
        const dataBuffer = new TextEncoder().encode(data);
        const signatureBuffer = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
        
        // 3. Import the PINNED public key (ignore any key from storage)
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
            {
                name: "RSASSA-PKCS1-v1_5",
                hash: "SHA-256",
            },
            false,
            ["verify"]
        );
        
        // 4. Verify the signature
        const isValid = await window.crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            publicKey,
            signatureBuffer,
            dataBuffer
        );
        
        if (!isValid) {
            console.error("Permission signature verification failed! The permissions have been tampered with.");
            throw new Error("TAMPER_DETECTED");
        }
        
        return JSON.parse(data);
    } catch (e) {
        console.error("Permission decoding or verification failed:", e);
        throw e;
    }
}

export const SessionProvider = ({ children }: { children: ReactNode }) => {
    const [sessionState, setSessionState] = useState<SessionState>({
        loading: true,
        profile: null,
        permissions: null,
        accountId: null,
        personalAccountId: null,
        isManaging: false,
        refetch: () => { },
    });

    const fetchData = async (forceRefresh = false) => {
        setSessionState(s => ({ ...s, loading: true }));

        if (!forceRefresh && typeof window !== 'undefined') {
            const cachedData = sessionStorage.getItem(SESSION_STORAGE_KEY);
            const publicKey = sessionStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
            
            if (cachedData && publicKey) {
                try {
                    const parsedData = JSON.parse(cachedData);
                    
                    // CRITICAL: Re-verify the encoded permissions from cache before trusting it
                    if (parsedData.encodedPermissions) {
                        try {
                            const verifiedPermissions = await decodeAndVerifyPermissions(parsedData.encodedPermissions);
                            
                            // Check if the permissions array matches what's in the cache
                            // This prevents someone from changing the "permissions" field in session storage
                            const isConsistent = JSON.stringify(verifiedPermissions) === JSON.stringify(parsedData.permissions);
                            
                            if (isConsistent) {
                                setSessionState({ ...parsedData, loading: false, refetch: () => fetchData(true) });
                                return;
                            } else {
                                console.warn("Cache inconsistency detected. Forcing re-fetch.");
                            }
                        } catch (err) {
                            console.error("Cache verification failed. Tampering detected or key expired.");
                        }
                    }
                } catch (e) {
                    console.error("Cache parsing error:", e);
                    sessionStorage.removeItem(SESSION_STORAGE_KEY);
                }
            }
        }

        try {
            const [activeId, personalId] = await Promise.all([
                getActiveAccountId(),
                getPersonalAccountId()
            ]);

        if (!activeId || !personalId) {
            setSessionState(s => ({ ...s, loading: false, profile: null, permissions: [] }));
            return;
        }

            const [profile, encodedPerms] = await Promise.all([
                fetchUserProfile(activeId),
                getEncodedUserPermissions(activeId)
            ]);

            const permissions = await decodeAndVerifyPermissions(encodedPerms.encoded);

            const newState = {
                loading: false,
                profile,
                permissions,
                accountId: activeId,
                personalAccountId: personalId,
                isManaging: activeId !== personalId,
                encodedPermissions: encodedPerms.encoded, // Save the signature for later re-verification
            };

            setSessionState({ ...newState, refetch: () => fetchData(true) });

            if (typeof window !== 'undefined') {
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newState));
                sessionStorage.setItem(PUBLIC_KEY_STORAGE_KEY, encodedPerms.publicKey);
            }

        } catch (error) {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
            setSessionState(s => ({ ...s, loading: false, profile: null, permissions: [] }));
        }
    };

    const clearCacheAndRefetch = () => {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            sessionStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
        }
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

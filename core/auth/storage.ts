export const PROFILE_INFO_KEY = 'profile';
export const JWT_KEY = 'jwt';

export type StoredProfileInfo = {
    firstName?: string;
    lastName?: string;
    neupId?: string;
    accountType?: string;
};

export function getStoredProfileInfo(): StoredProfileInfo | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(PROFILE_INFO_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setStoredProfileInfo(data: StoredProfileInfo) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PROFILE_INFO_KEY, JSON.stringify(data));
}

export function getStoredJwt(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(JWT_KEY);
}

export function setStoredJwt(token: string) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(JWT_KEY, token);
}

export function clearAuthStorage() {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(PROFILE_INFO_KEY);
    sessionStorage.removeItem(JWT_KEY);
}

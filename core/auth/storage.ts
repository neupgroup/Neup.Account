export const PROFILE_INFO_KEY = 'profile';
export const JWT_KEY = 'jwt';

export type StoredProfileInfo = {
    firstName?: string;
    lastName?: string;
    neupId?: string;
    accountType?: string;
};

type SessionDataMap = {
    [PROFILE_INFO_KEY]: StoredProfileInfo;
    [JWT_KEY]: string;
};

export function getSessionData<K extends keyof SessionDataMap>(key: K): SessionDataMap[K] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return key === JWT_KEY ? raw as SessionDataMap[K] : JSON.parse(raw);
    } catch {
        return null;
    }
}

export function setSessionData<K extends keyof SessionDataMap>(key: K, value: SessionDataMap[K]) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key, key === JWT_KEY ? value as string : JSON.stringify(value));
}

export function deleteSessionData(key?: keyof SessionDataMap) {
    if (typeof window === 'undefined') return;
    if (key) {
        sessionStorage.removeItem(key);
    } else {
        sessionStorage.removeItem(PROFILE_INFO_KEY);
        sessionStorage.removeItem(JWT_KEY);
    }
}

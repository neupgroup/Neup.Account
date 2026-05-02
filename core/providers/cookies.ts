import { cookies } from 'next/headers';
import { Singleton } from '@/core/interface/singleton';

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type SameSite = 'strict' | 'lax' | 'none';

export type CookieRawOptions = {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    path?: string;
    domain?: string;
    expires?: Date;
    maxAge?: number;
    partitioned?: boolean;
    priority?: 'low' | 'medium' | 'high';
};

class CookieProvider extends Singleton {
    public constructor() {
        super();
    }

    public static getInstance(): CookieProvider {
        return this.instanceFor<CookieProvider>();
    }

    private async store(): Promise<CookieStore> {
        return cookies();
    }

    async getCookies(): Promise<Record<string, string>> {
        const store = await this.store();
        const result: Record<string, string> = {};
        store.getAll().forEach(({ name, value }) => {
            result[name] = value;
        });
        return result;
    }

    async getCookie(name: string): Promise<string | undefined> {
        const store = await this.store();
        return store.get(name)?.value;
    }

    async setCookie(name: string, value: string, expiresOn: Date): Promise<void> {
        const store = await this.store();
        store.set(name, value, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            domain: process.env.COOKIE_DOMAIN || '.neupgroup.com',
            expires: expiresOn,
        });
    }

    async setCookieRaw(name: string, value: string, options: CookieRawOptions = {}): Promise<void> {
        const store = await this.store();
        store.set(name, value, {
            httpOnly: options.httpOnly ?? true,
            secure: options.secure ?? true,
            sameSite: options.sameSite ?? 'lax',
            path: options.path ?? '/',
            domain: options.domain,
            expires: options.expires,
            maxAge: options.maxAge,
            partitioned: options.partitioned,
            priority: options.priority,
        });
    }

    async deleteCookie(name: string): Promise<void> {
        const store = await this.store();
        store.delete(name);
    }
}

export const cookieProvider = CookieProvider.getInstance();

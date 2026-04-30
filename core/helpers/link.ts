import { APP_BASE_PATH } from '@/core/appconfig';

type RouterLike = {
    push: (href: string, options?: { scroll?: boolean }) => void;
    replace: (href: string, options?: { scroll?: boolean }) => void;
};

type RedirectOptions = {
    replace?: boolean;
    hard?: boolean;
    scroll?: boolean;
};

/**
 * Resolves a path to include the base path for hard (window.location) navigation.
 * Paths that are already absolute URLs are returned as-is.
 */
function resolveHref(path: string): string {
    if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
        return path;
    }
    // Avoid double base path
    if (path.startsWith(APP_BASE_PATH)) {
        return path;
    }
    return `${APP_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Redirects within the app.
 *
 * - When `router` is provided: uses Next.js router (base path handled automatically by Next.js).
 * - When `hard: true` or no router: uses window.location.href with base path prepended.
 *
 * @param path  App-relative path, e.g. '/auth/start'
 * @param router  Next.js router instance (optional — omit for hard navigation)
 * @param options  { replace, hard, scroll }
 */
export function redirectInApp(
    path: string,
    router?: RouterLike | null,
    options: RedirectOptions = {}
): void {
    const { replace = false, hard = false, scroll } = options;

    if (router && !hard) {
        const navOptions = scroll !== undefined ? { scroll } : undefined;
        if (replace) {
            router.replace(path, navOptions);
        } else {
            router.push(path, navOptions);
        }
        return;
    }

    // Hard navigation — must include base path manually
    const resolved = resolveHref(path);
    if (replace) {
        window.location.replace(resolved);
    } else {
        window.location.href = resolved;
    }
}

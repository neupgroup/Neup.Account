// Client-side navigation helpers.
// Use redirectInApp for in-app navigation via the Next.js router.
// Use redirectInDomain for same-origin hard navigation.
// Use redirectHttps / redirectHttp for external URLs.

type RouterNavigationOptions = {
  scroll?: boolean;
};

type AppRouterLike = {
  push: (href: string, options?: RouterNavigationOptions) => void;
  replace: (href: string, options?: RouterNavigationOptions) => void;
};

type AppRedirectOptions = RouterNavigationOptions & {
  replace?: boolean;
};

type BrowserRedirectOptions = {
  replace?: boolean;
};

// Performs a hard browser navigation using window.location.
function navigateInBrowser(targetUrl: string, options: BrowserRedirectOptions = {}) {
  if (typeof window === 'undefined') return;

  if (options.replace) {
    window.location.replace(targetUrl);
    return;
  }

  window.location.assign(targetUrl);
}

// Normalizes a value into an absolute URL string using the given protocol as fallback.
// Handles protocol-relative URLs (//example.com) and bare hostnames.
function normalizeAbsoluteUrl(value: string, defaultProtocol: 'http:' | 'https:') {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
    return new URL(value).toString();
  }

  if (value.startsWith('//')) {
    return new URL(`${defaultProtocol}${value}`).toString();
  }

  return new URL(`${defaultProtocol}//${value}`).toString();
}

// Navigates within the app using the Next.js router.
// Supports push (default) or replace, and optional scroll control.
export function redirectInApp(router: AppRouterLike, href: string, options: AppRedirectOptions = {}) {
  const { replace = false, scroll } = options;
  const navigationOptions = scroll === undefined ? undefined : { scroll };

  if (replace) {
    router.replace(href, navigationOptions);
    return;
  }

  router.push(href, navigationOptions);
}

// Performs a hard navigation to a same-origin path or URL.
// Throws if the target resolves to a different origin.
export function redirectInDomain(pathOrUrl: string, options: BrowserRedirectOptions = {}) {
  if (typeof window === 'undefined') return;

  const targetUrl = new URL(pathOrUrl, window.location.origin);

  if (targetUrl.origin !== window.location.origin) {
    throw new Error(`redirectInDomain only supports same-domain URLs. Received: ${pathOrUrl}`);
  }

  navigateInBrowser(targetUrl.toString(), options);
}

// Navigates to an external HTTPS URL.
export function redirectHttps(value: string, options: BrowserRedirectOptions = {}) {
  navigateInBrowser(normalizeAbsoluteUrl(value, 'https:'), options);
}

// Navigates to an external HTTP URL.
export function redirectHttp(value: string, options: BrowserRedirectOptions = {}) {
  navigateInBrowser(normalizeAbsoluteUrl(value, 'http:'), options);
}

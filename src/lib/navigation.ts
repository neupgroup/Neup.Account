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

function navigateInBrowser(targetUrl: string, options: BrowserRedirectOptions = {}) {
  if (typeof window === 'undefined') return;

  if (options.replace) {
    window.location.replace(targetUrl);
    return;
  }

  window.location.assign(targetUrl);
}

function normalizeAbsoluteUrl(value: string, defaultProtocol: 'http:' | 'https:') {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
    return new URL(value).toString();
  }

  if (value.startsWith('//')) {
    return new URL(`${defaultProtocol}${value}`).toString();
  }

  return new URL(`${defaultProtocol}//${value}`).toString();
}

export function redirectInApp(router: AppRouterLike, href: string, options: AppRedirectOptions = {}) {
  const { replace = false, scroll } = options;
  const navigationOptions = scroll === undefined ? undefined : { scroll };

  if (replace) {
    router.replace(href, navigationOptions);
    return;
  }

  router.push(href, navigationOptions);
}

export function redirectInDomain(pathOrUrl: string, options: BrowserRedirectOptions = {}) {
  if (typeof window === 'undefined') return;

  const targetUrl = new URL(pathOrUrl, window.location.origin);

  if (targetUrl.origin !== window.location.origin) {
    throw new Error(`redirectInDomain only supports same-domain URLs. Received: ${pathOrUrl}`);
  }

  navigateInBrowser(targetUrl.toString(), options);
}

export function redirectHttps(value: string, options: BrowserRedirectOptions = {}) {
  navigateInBrowser(normalizeAbsoluteUrl(value, 'https:'), options);
}

export function redirectHttp(value: string, options: BrowserRedirectOptions = {}) {
  navigateInBrowser(normalizeAbsoluteUrl(value, 'http:'), options);
}

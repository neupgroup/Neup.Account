'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import NProgress from 'nprogress';

function NProgressEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  return null;
}

export function PageProgressBar() {
  useEffect(() => {
    // Configure NProgress
    NProgress.configure({ showSpinner: false });

    const handleAnchorClick = (event: MouseEvent) => {
      const anchorElement = event.currentTarget as HTMLAnchorElement;
      
      // Check if the link opens in a new tab
      const isNewTab = 
        event.metaKey || 
        event.ctrlKey || 
        event.button === 1 || 
        anchorElement.target === '_blank';

      // Check if it's a same-origin navigation
      if (!anchorElement.href) return;
      
      const targetUrl = new URL(anchorElement.href);
      const currentUrl = new URL(window.location.href);

      // Start progress only for same-origin, same-tab navigations
      if (targetUrl.origin === currentUrl.origin && !isNewTab) {
        NProgress.start();
      }
    };

    const handleMutation: MutationCallback = () => {
      const anchorElements = document.querySelectorAll('a');
      anchorElements.forEach((anchor) => {
        // We use a custom attribute to track if the listener has been added.
        if (!anchor.hasAttribute('data-nprogress-listener')) {
            anchor.setAttribute('data-nprogress-listener', 'true');
            anchor.addEventListener('click', handleAnchorClick);
        }
      });
    };

    const mutationObserver = new MutationObserver(handleMutation);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Initial run
    handleMutation();

    // We don't need to return a cleanup function that removes listeners,
    // as the component mounts only once and we want the listeners to persist.
    // If we did, we'd need to track listeners to remove them properly.
    return () => {
        mutationObserver.disconnect();
    };
  }, []);

  return (
    <Suspense>
      <NProgressEvents />
    </Suspense>
  );
}
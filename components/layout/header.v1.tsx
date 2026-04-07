'use client';

import { NeupIdLogo } from '@/components/neupid-logo';
import { UserNav } from '@/components/user-nav';
import { usePathname } from 'next/navigation';

type HeaderV1Props = {
  showUserNavOnAuth?: boolean;
};

export function HeaderV1({ showUserNavOnAuth = false }: HeaderV1Props) {
  const pathname = usePathname();
  const isAuthPath = pathname?.startsWith('/auth');
  const shouldShowUserNav = showUserNavOnAuth || !isAuthPath;

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b bg-background shadow-sm">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 lg:px-6">
        <NeupIdLogo iconHref="https://neupgroup.com" textHref="/" />
        {shouldShowUserNav ? <UserNav /> : <div className="h-9 w-9" aria-hidden="true" />}
      </div>
    </header>
  );
}

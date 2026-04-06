import type {Metadata} from 'next';
import './globals.css';
import 'nprogress/nprogress.css';
import { Toaster } from "@/components/ui/toaster"
import { GeolocationProvider } from '@/context/geolocation-context';
import { PageProgressBar } from '@/components/page-progress-bar';
import { Suspense } from 'react';
import { UrlErrorBanner } from '@/components/ui/url-error-banner';
import { PersistentBacksTo } from '@/components/persistent-backs-to';

export const metadata: Metadata = {
  title: 'Neup.Account',
  description: 'Create an account to access NeupID Group Products and Services.',
  metadataBase: new URL('https://neupgroup.com/account'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <GeolocationProvider>
          <PersistentBacksTo />
          <PageProgressBar />
          {children}
          <Toaster />
          <Suspense>
            <UrlErrorBanner />
          </Suspense>
        </GeolocationProvider>
      </body>
    </html>
  );
}

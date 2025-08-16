import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import PageProgressBar from '@/components/page-progress-bar';
import { GeolocationClientProvider } from '@/context/geolocation-provider';

export const metadata: Metadata = {
  title: 'NeupID',
  description: 'Create an account to access NeupID Group Products and Services.',
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
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <GeolocationClientProvider>
          <PageProgressBar />
          {children}
          <Toaster />
        </GeolocationClientProvider>
      </body>
    </html>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NeupIdLogo } from '@/components/neupid-logo';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
       <header className="sticky top-0 z-50 flex h-16 w-full items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-[1368px] items-center px-4 lg:px-6">
          <NeupIdLogo iconHref={process.env.NEXT_PUBLIC_COMPANY_URL || "/"} textHref="/" />
        </div>
      </header>
       <main className="flex flex-1 items-center justify-center p-6">
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center text-center">
             <AlertTriangle className="h-16 w-16 text-primary" />
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Page Not Found</h1>
            <p className="mt-4 text-muted-foreground">
                Sorry, we couldn’t find the page you’re looking for. It might have been moved or deleted.
            </p>
            <Button asChild className="mt-8">
                <Link href="/">Go back home</Link>
            </Button>
        </div>
       </main>
    </div>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[60vh]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">404 - Page Not Found</h2>
        <p className="mt-2 text-muted-foreground">
            The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild className="mt-6">
            <Link href="/">Go to Dashboard</Link>
        </Button>
    </div>
  );
}

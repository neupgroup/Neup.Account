
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/core/helpers/utils';

export function BackButton({ href, className }: { href: string, className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 text-sm font-bold text-foreground hover:underline underline-offset-4", className)}>
        <ChevronLeft className="h-4 w-4" />
        Go back
    </Link>
  );
}



"use client";

import { useEffect, useState, useTransition } from 'react';
import { getUnreadWarnings, markWarningAsRead, type UserWarning } from '@/lib/user-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Bell } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { getNotifications } from '../app/manage/notifications/actions';
import { usePathname } from 'next/navigation';
import { cva, type VariantProps } from 'class-variance-authority';

export function NotificationBell({ className }: { className?: string}) {
    const [hasNotifications, setHasNotifications] = useState(false);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        const fetchNotifications = async () => {
            const fetchedNotifications = await getNotifications();
            const unreadCount = fetchedNotifications.warnings.length + fetchedNotifications.requests.length;
            setHasNotifications(unreadCount > 0);
            setLoading(false);
        };

        fetchNotifications();
    }, [pathname]); // Refetch on path change

    if (loading) {
        return <Skeleton className={cn("h-6 w-6 rounded-full", className)} />;
    }

    if (hasNotifications) {
        return (
            <div className={cn("relative", className)}>
                <Bell className="h-full w-full" />
                <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
            </div>
        );
    }
    
    return <Bell className={className} />;
}


const warningVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      noticeType: {
        general: "bg-blue-50 border-blue-200 text-blue-800 [&>svg]:text-blue-500",
        success: "bg-green-50 border-green-200 text-green-800 [&>svg]:text-green-500",
        warning: "bg-orange-50 border-orange-200 text-orange-800 [&>svg]:text-orange-500",
        error: "bg-destructive/10 border-destructive/20 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      noticeType: "general",
    },
  }
)

export function WarningDisplay() {
    const [warnings, setWarnings] = useState<UserWarning[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const fetchWarnings = async () => {
            const fetchedWarnings = await getUnreadWarnings();
            setWarnings(fetchedWarnings);
            setLoading(false);
        };

        fetchWarnings();
    }, []);

    const handleDismiss = async (warningId: string) => {
        startTransition(async () => {
            await markWarningAsRead(warningId);
            setWarnings(prev => prev.filter(w => w.id !== warningId));
        });
    };

    if (loading) {
        return <Skeleton className="h-24 w-full mb-4" />;
    }

    if (warnings.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4 mb-4">
            {warnings.map(warning => (
                <div key={warning.id} className={cn(warningVariants({ noticeType: warning.noticeType }))}>
                     <div className="flex items-start">
                        <AlertTriangle className="h-4 w-4" />
                        <div className="ml-3 flex-1">
                             <h5 className="mb-1 font-medium leading-none tracking-tight">Important Notice</h5>
                            <div className="text-sm [&_p]:leading-relaxed" dangerouslySetInnerHTML={{ __html: warning.message }} />
                        </div>
                        {warning.persistence === 'dismissable' && (
                             <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 -mt-1 -mr-2 flex-shrink-0"
                                onClick={() => handleDismiss(warning.id)}
                                disabled={isPending}
                                aria-label="Dismiss warning"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

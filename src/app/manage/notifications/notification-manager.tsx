

"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Bell, MessageSquareWarning } from '@/components/icons';
import type { AllNotifications, Notification } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { checkPermissions } from '@/lib/user';
import { markNotificationAsRead } from '@/actions/notifications';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import { TertiaryHeader } from '@/components/ui/tertiary-header';

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

function getActionText(action: string, senderName: string): string {
    if (action === 'family_invitation') {
        return `${senderName} has invited you to join their family.`;
    }
     if (action === 'neupid_request') {
        return `${senderName} has requested a new NeupID.`;
    }
    if (action === 'access_invitation') {
        return `${senderName} wants you to help manage their account.`;
    }
    return 'You have a new request.';
}

export function NotificationManager({ initialNotifications }: { initialNotifications: AllNotifications }) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [isPending, startTransition] = useTransition();
    const [canMarkAsRead, setCanMarkAsRead] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const verifyPermission = async () => {
            const hasPerm = await checkPermissions(['notification.mark_as_read']);
            setCanMarkAsRead(hasPerm);
        };
        verifyPermission();
    }, []);

    const handleDismiss = (id: string, type: 'sticky' | 'other') => {
        startTransition(async () => {
            const result = await markNotificationAsRead(id);
            if (result.success) {
                toast({ title: 'Notification dismissed' });
                setNotifications(prev => ({ ...prev, [type]: prev[type].filter(item => item.id !== id) }));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: "Could not dismiss notification." });
            }
        });
    };

    const hasNotifications = notifications.sticky.length > 0 || notifications.requests.length > 0 || notifications.other.length > 0;

    return (
        <div className="space-y-6">
            {notifications.sticky.length > 0 && (
                <div className="space-y-2">
                    <TertiaryHeader title="Important Notices" />
                     <div className="space-y-3">
                        {notifications.sticky.map(warning => (
                             <div key={warning.id} className={cn(warningVariants({ noticeType: warning.noticeType }))}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-4 w-4" />
                                        <div className="flex-1">
                                            <h5 className="mb-1 font-medium leading-none tracking-tight">Important Notice</h5>
                                            <div className="text-sm [&_p]:leading-relaxed" dangerouslySetInnerHTML={{ __html: warning.message || "" }} />
                                        </div>
                                    </div>
                                    {canMarkAsRead && warning.persistence === 'dismissable' && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleDismiss(warning.id, 'sticky')} disabled={isPending} aria-label="Dismiss warning">
                                        <X className="h-4 w-4" />
                                    </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {notifications.requests.length > 0 && (
                 <div className="space-y-2">
                    <TertiaryHeader title="Action Required" />
                    <Card>
                        <CardContent className="divide-y p-0">
                            {notifications.requests.map(request => (
                                <Link 
                                    key={request.id} 
                                    href="/manage/people/invitations" 
                                    className="flex items-center justify-between p-4 rounded-md hover:bg-muted/50 first:pt-0 last:pb-0"
                                >
                                    <div className="flex items-center gap-3 flex-grow">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>{request.senderName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{getActionText(request.action, request.senderName || 'A user')}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                 </div>
            )}
            
            {notifications.other.length > 0 && (
                 <div className="space-y-2">
                    <TertiaryHeader title="For Your Information" />
                    <Card>
                        <CardContent className="divide-y p-0">
                            {notifications.other.map(item => (
                                <div key={item.id} className="flex items-start justify-between gap-4 p-4">
                                    <div className="flex items-start gap-3">
                                        <MessageSquareWarning className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div className="flex-grow">
                                            <p className="text-sm">{item.message}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleDismiss(item.id, 'other')} disabled={isPending}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                 </div>
            )}


            {!hasNotifications && (
                 <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <Bell className="mx-auto h-12 w-12 mb-4" />
                        <h3 className="text-lg font-semibold">All caught up!</h3>
                        <p>You have no new notifications.</p>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}

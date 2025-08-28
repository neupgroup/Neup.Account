"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Check, MailQuestion, Users, Bell } from '@/components/icons';
import type { AllNotifications, Notification } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { checkPermissions } from '@/lib/user';
import { markNotificationAsRead } from '@/actions/notifications';
import Link from 'next/link';

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

    const handleDismissWarning = (id: string) => {
        startTransition(async () => {
            const result = await markNotificationAsRead(id);
            if (result.success) {
                toast({ title: 'Notification dismissed' });
                setNotifications(prev => ({ ...prev, sticky: prev.sticky.filter(item => item.id !== id) }));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: "Could not dismiss warning." });
            }
        });
    };

    const hasNotifications = notifications.sticky.length > 0 || notifications.requests.length > 0;

    return (
        <div className="space-y-6">
            {notifications.sticky.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/> Warnings</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {notifications.sticky.map(warning => (
                             <Alert key={warning.id} variant="destructive" className="relative pr-10">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Important Notice</AlertTitle>
                                <AlertDescription>
                                    {warning.message}
                                </AlertDescription>
                                {canMarkAsRead && warning.persistence === 'dismissable' && (
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => handleDismissWarning(warning.id)} disabled={isPending} aria-label="Dismiss warning">
                                    <X className="h-4 w-4" />
                                </Button>
                                )}
                            </Alert>
                        ))}
                    </CardContent>
                </Card>
            )}

            {notifications.requests.length > 0 && (
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Bell /> Requests</CardTitle></CardHeader>
                    <CardContent className="space-y-3 divide-y">
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



"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Check, MailQuestion, Users, Bell } from 'lucide-react';
import type { AllNotifications, Notification } from './actions';
import { acceptRequest, rejectRequest, markNotificationAsRead } from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { checkPermissions, markWarningAsRead } from '@/lib/user-actions';
import Link from 'next/link';

function getActionLink(action: string, requestId: string): string {
    if (action.includes('family')) return '/manage/people/family';
    if (action.includes('neupid')) return `/manage/root/requests/${requestId}`;
    return '#';
}

function getActionText(action: string, senderName: string): string {
    if (action === 'family_invitation') {
        return `${senderName} has invited you to join their family.`;
    }
     if (action === 'neupid_request') {
        return `${senderName} has requested a new NeupID.`;
    }
    return 'You have a new request.';
}

export function NotificationManager({ initialNotifications }: { initialNotifications: AllNotifications }) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [isPending, startTransition] = useTransition();
    const [canMarkAsRead, setCanMarkAsRead] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useState(async () => {
        setCanMarkAsRead(await checkPermissions(['notification.mark_as_read']));
    })

    const handleDismissWarning = (id: string) => {
        startTransition(async () => {
            const result = await markWarningAsRead(id);
            if (result.success) {
                toast({ title: 'Notification dismissed' });
                setNotifications(prev => ({ ...prev, warnings: prev.warnings.filter(item => item.id !== id) }));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: "Could not dismiss warning." });
            }
        });
    };
    
    const handleAccept = (requestId: string, notificationId: string) => {
        startTransition(async () => {
            const result = await acceptRequest(requestId, notificationId);
            if (result.success) {
                toast({ title: 'Request accepted!', className: 'bg-accent text-accent-foreground' });
                setNotifications(prev => ({ ...prev, requests: prev.requests.filter(item => item.id !== notificationId)}));
                router.refresh();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }
    
    const handleReject = (requestId: string, notificationId: string) => {
        startTransition(async () => {
            const result = await rejectRequest(requestId, notificationId);
            if (result.success) {
                toast({ title: 'Request rejected.' });
                setNotifications(prev => ({ ...prev, requests: prev.requests.filter(item => item.id !== notificationId)}));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }

    const handleMarkAsRead = (notificationId: string) => {
        startTransition(async () => {
            await markNotificationAsRead(notificationId);
        });
    };

    const hasNotifications = notifications.warnings.length > 0 || notifications.requests.length > 0;

    return (
        <div className="space-y-6">
            {notifications.warnings.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/> Warnings</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {notifications.warnings.map(warning => (
                             <Alert key={warning.id} variant="destructive" className="relative pr-10">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Important Notice</AlertTitle>
                                <AlertDescription>
                                    {warning.message}
                                </AlertDescription>
                                {canMarkAsRead && <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => handleDismissWarning(warning.id)} disabled={isPending} aria-label="Dismiss warning">
                                    <X className="h-4 w-4" />
                                </Button>}
                            </Alert>
                        ))}
                    </CardContent>
                </Card>
            )}

            {notifications.requests.length > 0 && (
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Bell /> Requests</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                         {notifications.requests.map(request => (
                            <div key={request.id} className="flex items-center justify-between p-4 rounded-md border">
                                <Link href={getActionLink(request.action, request.requestId)} className="flex items-center gap-3 flex-grow" onClick={() => handleMarkAsRead(request.id)}>
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback>{request.senderName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium">{request.senderName}</p>
                                        <p className="text-xs text-muted-foreground">{getActionText(request.action, request.senderName)}</p>
                                    </div>
                                </Link>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 border-green-600 hover:bg-green-50" disabled={isPending} onClick={() => handleAccept(request.requestId, request.id)}><Check className="h-4 w-4" /></Button>
                                    <Button variant="destructive" size="icon" className="h-8 w-8" disabled={isPending} onClick={() => handleReject(request.requestId, request.id)}><X className="h-4 w-4" /></Button>
                                </div>
                            </div>
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

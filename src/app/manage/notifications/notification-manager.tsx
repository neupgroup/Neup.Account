

"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Bell, MessageSquareWarning, Users, Handshake, type LucideIcon } from '@/components/icons';
import type { AllNotifications, Notification } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { checkPermissions } from '@/lib/user';
import { markNotificationAsRead, deleteNotification } from '@/actions/notifications';
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

function getActionDetails(notification: Notification): { text: string, href: string, icon: LucideIcon } {
    let text = notification.message || 'You have a new notification.';
    let href = '/manage/notifications';
    let icon: LucideIcon = MessageSquareWarning;

    switch (notification.action) {
        case 'family_invitation':
            text = `${notification.senderName} has invited you to join their family.`;
            href = '/manage/people/invitations';
            icon = Users;
            break;
        case 'access_invitation':
            text = `${notification.senderName} wants you to help manage their account.`;
            href = '/manage/people/invitations';
            icon = Handshake;
            break;
        case 'informative.login':
        case 'informative.logout':
        case 'informative.unblock':
            href = '/manage/security/devices';
            icon = MessageSquareWarning;
            break;
        case 'informative.security':
            href = '/manage/security';
            icon = MessageSquareWarning;
            break;
        default:
             icon = Bell;
             break;
    }

    if (notification.action?.includes('sticky')) {
        icon = AlertTriangle;
    }

    return { text, href, icon };
}

const formatDate = (isoString: string) => {
    const notificationDate = new Date(isoString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    if (notificationDate >= startOfToday) {
        return notificationDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); // e.g., 3:30 PM
    } else if (notificationDate >= startOfYesterday) {
        return 'Yesterday';
    } else {
        return notificationDate.toLocaleDateString(); // e.g., 8/15/2023
    }
};

export function NotificationManager({ initialNotifications }: { initialNotifications: AllNotifications }) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [isPending, startTransition] = useTransition();
    const [canMarkAsRead, setCanMarkAsRead] = useState(false);
    const [canDelete, setCanDelete] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const verifyPermissions = async () => {
            const [hasReadPerm, hasDeletePerm] = await Promise.all([
                checkPermissions(['notification.mark_as_read']),
                checkPermissions(['notification.delete'])
            ]);
            setCanMarkAsRead(hasReadPerm);
            setCanDelete(hasDeletePerm);
        };
        verifyPermissions();
    }, []);

    const handleLinkClick = async (id: string, href: string) => {
        if(canMarkAsRead) {
            await markNotificationAsRead(id);
        }
        router.push(href);
    };

    const handleDelete = (id: string, type: 'sticky' | 'other' | 'requests') => {
        startTransition(async () => {
            const result = await deleteNotification(id);
            if (result.success) {
                toast({ title: 'Notification deleted' });
                setNotifications(prev => ({ ...prev, [type]: prev[type].filter(item => item.id !== id) }));
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || "Could not delete notification." });
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
                                    {canDelete && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 -my-1 -mr-2 text-current" onClick={(e) => { e.preventDefault(); handleDelete(warning.id, 'sticky'); }} disabled={isPending} aria-label="Delete warning">
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
                            {notifications.requests.map(request => {
                                const { text, href, icon: Icon } = getActionDetails(request);
                                return (
                                <div 
                                    key={request.id} 
                                    className="flex items-center justify-between p-4 group"
                                >
                                    <button 
                                        onClick={() => handleLinkClick(request.id, href)} 
                                        className="flex items-center gap-3 flex-grow text-left hover:bg-muted/50 -m-4 p-4 rounded-l-md"
                                        aria-label={`View request from ${request.senderName}`}
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>{request.senderName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{text}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
                                        </div>
                                    </button>
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(request.id, 'requests')} disabled={isPending}>
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Delete request</span>
                                    </Button>
                                </div>
                                )
                            })}
                        </CardContent>
                    </Card>
                 </div>
            )}
            
            {notifications.other.length > 0 && (
                 <div className="space-y-2">
                    <TertiaryHeader title="For Your Information" />
                    <Card>
                        <CardContent className="divide-y p-0">
                            {notifications.other.map(item => {
                                const { href, message, icon: Icon } = getActionDetails(item);
                                return (
                                    <div key={item.id} className="flex items-start justify-between gap-4 p-4 group">
                                         <button 
                                            onClick={() => handleLinkClick(item.id, href)} 
                                            className="flex items-center gap-3 flex-grow text-left hover:bg-muted/50 -m-4 p-4 rounded-l-md"
                                            aria-label={`View notification: ${message}`}
                                        >
                                            <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                            <div className="flex-grow">
                                                <p className="text-sm">{message}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                                            </div>
                                        </button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 -my-1 -mr-2 text-muted-foreground group-hover:text-destructive" onClick={(e) => { e.preventDefault(); handleDelete(item.id, 'other'); }} disabled={isPending}>
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Delete notification</span>
                                        </Button>
                                    </div>
                                )
                            })}
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



'use client';

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
            text = notification.message || 'An update regarding your account sessions.';
            href = '/manage/security/devices';
            icon = MessageSquareWarning;
            break;
        case 'informative.security':
            text = notification.message || 'A security update on your account.';
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
    const seconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

    if (seconds < 60) return "just now";
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
};


export function NotificationManager({ initialNotifications }: { initialNotifications: AllNotifications }) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [isPending, startTransition] = useTransition();
    const [canDelete, setCanDelete] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const verifyPermissions = async () => {
            const hasDeletePerm = await checkPermissions(['notification.delete']);
            setCanDelete(hasDeletePerm);
        };
        verifyPermissions();
    }, []);

    const handleLinkClick = async (id: string, href: string) => {
        await markNotificationAsRead(id);
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
    
    const isDeletable = (notification: Notification) => {
        return canDelete && notification.deletableOn;
    }


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
                                    {warning.persistence === 'dismissable' && (
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
                                     {isDeletable(request) && (
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(request.id, 'requests')} disabled={isPending}>
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Delete request</span>
                                    </Button>
                                    )}
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
                                const { href, text: message, icon: Icon } = getActionDetails(item);
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
                                        {isDeletable(item) && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 -my-1 -mr-2 text-muted-foreground group-hover:text-destructive" onClick={(e) => { e.preventDefault(); handleDelete(item.id, 'other'); }} disabled={isPending}>
                                            <X className="h-4 w-4" />
                                            <span className="sr-only">Delete notification</span>
                                        </Button>
                                        )}
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

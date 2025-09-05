
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getNotifications, type Notification } from '@/actions/notifications';
import Link from 'next/link';
import { AlertTriangle, Bell, ChevronRight, Handshake, MessageSquareWarning, UserPlus } from '@/components/icons';
import { SecondaryHeader } from '../ui/secondary-header';
import { ListItem } from '../ui/list-item';

function getNotificationDetails(notification: Notification): { icon: React.ElementType, message: string } {
    if (notification.action.includes('sticky')) {
        return { icon: AlertTriangle, message: notification.message || 'An important notice was posted.' };
    }
    if (notification.action === 'access_invitation') {
        return { icon: Handshake, message: `${notification.senderName} wants you to manage their account.` };
    }
    if (notification.action === 'family_invitation') {
        return { icon: UserPlus, message: `${notification.senderName} invited you to their family.` };
    }
    return { icon: MessageSquareWarning, message: notification.message || 'You have a new notification.' };
}

export async function NotificationsCard() {
    const allNotifications = await getNotifications();

    const prioritizedNotifications = [
        ...allNotifications.sticky,
        ...allNotifications.requests,
        ...allNotifications.other
    ];
    
    const topThreeNotifications = prioritizedNotifications.slice(0, 3);
    const hasMoreNotifications = prioritizedNotifications.length > 3;

    if (prioritizedNotifications.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <SecondaryHeader 
                title="Account Updates"
                description="Your most recent and important alerts."
            />
            <Card>
                <CardContent className="divide-y p-0">
                    {topThreeNotifications.map(notification => {
                        const { icon, message } = getNotificationDetails(notification);
                        let href = '/manage/notifications';
                        if (notification.action.includes('invitation')) {
                            href = '/manage/people/invitations';
                        }
                        return (
                            <ListItem
                                key={notification.id}
                                href={href}
                                icon={icon}
                                title={message}
                                description={new Date(notification.createdAt).toLocaleString()}
                            />
                        )
                    })}
                     {hasMoreNotifications && (
                        <ListItem
                            href="/manage/notifications"
                            icon={Bell}
                            title="See all notifications"
                            description={`You have ${prioritizedNotifications.length - 3} more unread notifications.`}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

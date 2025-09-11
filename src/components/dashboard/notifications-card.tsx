
import { Card, CardContent } from '@/components/ui/card';
import { getNotifications, type Notification } from '@/actions/notifications';
import { AlertTriangle, Bell, Handshake, MessageSquareWarning, UserPlus } from '@/components/icons';
import { SecondaryHeader } from '../ui/secondary-header';
import { ListItem } from '../ui/list-item';

function getNotificationDetails(notification: Notification): { icon: string, message: string, href: string } {
    const defaultHref = '/manage/notifications';
    let href = defaultHref;
    let message = notification.message || 'You have a new notification.';
    let icon = 'MessageSquareWarning';

    switch (notification.action) {
        case 'informative.login':
        case 'informative.logout':
        case 'informative.unblock':
            href = '/manage/security/devices';
            break;
        case 'informative.security':
            href = '/manage/security';
            break;
        case 'access_invitation':
            icon = 'Handshake';
            message = `${notification.senderName} wants you to manage their account.`;
            href = '/manage/people/invitations';
            break;
        case 'family_invitation':
            icon = 'UserPlus';
            message = `${notification.senderName} invited you to join their family.`;
            href = '/manage/people/invitations';
            break;
    }
    
    if (notification.action?.includes('sticky')) {
        icon = 'AlertTriangle';
        message = notification.message || 'An important notice was posted.';
    }

    return { icon, message, href };
}

export async function NotificationsCard() {
    const allNotifications = await getNotifications();

    const prioritizedNotifications = [
        ...allNotifications.sticky,
        ...allNotifications.requests,
        ...allNotifications.other
    ].filter(n => !n.isRead); // Only show unread notifications on the dashboard
    
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
                        const { icon, message, href } = getNotificationDetails(notification);
                        return (
                            <ListItem
                                key={notification.id}
                                href={href}
                                iconName={icon}
                                title={message}
                                description={new Date(notification.createdAt).toLocaleString()}
                            />
                        )
                    })}
                     {hasMoreNotifications && (
                        <ListItem
                            href="/manage/notifications"
                            iconName="Bell"
                            title="See all notifications"
                            description={`You have ${prioritizedNotifications.length - 3} more unread notifications.`}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

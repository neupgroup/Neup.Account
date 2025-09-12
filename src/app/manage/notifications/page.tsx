

import { checkPermissions } from '@/lib/user';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Ban } from '@/components/icons';
import { getNotifications } from '@/actions/notifications';
import { NotificationManager } from './notification-manager';
import { PrimaryHeader } from '@/components/ui/primary-header';

export default async function NotificationsPage() {
    const canRead = await checkPermissions(['notification.read']);

    if (!canRead) {
        return (
             <Alert variant="destructive">
                <Ban className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to view notifications.
                </AlertDescription>
            </Alert>
        );
    }
    
    const notifications = await getNotifications();
    
    return (
        <div className="grid gap-8">
             <PrimaryHeader
                title="Notifications"
                description="Review warnings, invitations, and other account alerts."
             />
            <NotificationManager initialNotifications={notifications} />
        </div>
    );
}



import { checkPermissions } from '@/lib/user-actions';
import { notFound } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Ban } from 'lucide-react';
import { getNotifications } from './actions';
import { NotificationManager } from './notification-manager';

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
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
                <p className="text-muted-foreground">
                    Review warnings, invitations, and other account alerts.
                </p>
            </div>
            <NotificationManager initialNotifications={notifications} />
        </div>
    );
}

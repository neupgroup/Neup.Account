
import { checkPermissions } from '@/core/helpers/user';
import { notFound } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { BillingCard } from '@/components/dashboard/billing-card';
import { SettingsCard } from '@/components/dashboard/settings-card';
import { WarningDisplay } from '@/components/warning-display';
import { getActiveAccountId } from '@/core/auth/session';
import { NotificationsCard } from '@/components/dashboard/notifications-card';

export default async function HomePage() {
    const accountId = await getActiveAccountId();
    if (!accountId) {
      notFound();
    }

    const [canViewNotifications, canViewBilling] = await Promise.all([
        checkPermissions(['notification.read']),
        checkPermissions(['payment.subscriptions.show']),
    ]);
    
    return (
        <div className="grid gap-8">
            <WarningDisplay />
            <DashboardHeader />
            {canViewNotifications && <NotificationsCard />}
            <SettingsCard />
            {canViewBilling && <BillingCard />}
        </div>
    )
}

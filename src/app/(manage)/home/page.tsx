
import { checkPermissions } from '@/lib/user';
import { notFound } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { BillingCard } from '@/components/dashboard/billing-card';
import { WarningDisplay } from '@/components/warning-display';
import { getActiveAccountId } from '@/lib/auth-actions';
import { NotificationsCard } from '@/components/dashboard/notifications-card';
import { AccessCard } from '@/components/dashboard/access-card';
import { SecurityCard } from '@/components/dashboard/security-card';

export default async function HomePage() {
    const accountId = await getActiveAccountId();
    if (!accountId) {
      notFound();
    }

    const [canViewNotifications, canViewBilling, canViewAccess, canViewSecurity] = await Promise.all([
        checkPermissions(['notification.read']),
        checkPermissions(['payment.subscriptions.show']),
        checkPermissions(['security.third_party.view']),
        checkPermissions(['security.login_devices.view'])
    ]);
    
    return (
        <div className="grid gap-8">
            <WarningDisplay />
            <DashboardHeader />
            {canViewNotifications && <NotificationsCard />}
            {canViewSecurity && <SecurityCard />}
            {canViewAccess && <AccessCard />}
            {canViewBilling && <BillingCard />}
        </div>
    )
}

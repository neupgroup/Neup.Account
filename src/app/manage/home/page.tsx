import { checkPermissions } from '@/lib/user';
import { notFound } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { QuickActionsCard } from '@/components/dashboard/quick-actions-card';
import { BillingCard } from '@/components/dashboard/billing-card';
import { WarningDisplay } from '@/components/warning-display';
import { getActiveAccountId } from '@/lib/auth-actions';
import { getAccountType } from '@/lib/user';

export default async function HomePage() {
    const accountId = await getActiveAccountId();
    if (!accountId) {
      notFound();
    }

    const accountType = await getAccountType(accountId);
    
    return (
        <div className="grid gap-8">
            <WarningDisplay />
            <DashboardHeader />
            <AlertsCard />
            {accountType !== 'brand' && <QuickActionsCard />}
            <BillingCard />
        </div>
    )
}

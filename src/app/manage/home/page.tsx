
import { checkPermissions } from '@/lib/user-actions';
import { notFound } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { QuickActionsCard } from '@/components/dashboard/quick-actions-card';
import { BillingCard } from '@/components/dashboard/billing-card';
import { getUserProfile, getUserNeupIds } from '@/lib/user-actions';
import { getTotpStatus } from '@/actions/security/totp';
import { getRecoveryEmail } from '@/actions/security/email';
import { WarningDisplay } from '@/components/warning-display';

export default async function HomePage() {
    const [canViewProfile] = await Promise.all([
        checkPermissions(['profile.view']),
    ]);

    if (!canViewProfile) {
        notFound();
    }
    
     const [profile, neupIds, totpStatus, recoveryEmail] = await Promise.all([
        getUserProfile(''),
        getUserNeupIds(''),
        getTotpStatus(),
        getRecoveryEmail(),
    ]);

    const headerData = {
        profile,
        neupId: neupIds[0] || null,
        totpEnabled: totpStatus.isEnabled,
        recoveryEmailSet: !!recoveryEmail,
    };
    
    return (
        <div className="grid gap-8">
            <WarningDisplay />
            <DashboardHeader initialData={headerData} />
            <AlertsCard />
            <QuickActionsCard />
            <BillingCard />
        </div>
    )
}

import { getAccountType, checkPermissions } from '@/lib/user';
import { getActiveAccountId } from '@/lib/auth-actions';
import { IndividualProfileForm } from './individual-form';
import { BrandProfileForm } from './brand-form';
import { notFound } from 'next/navigation';
import { SecondaryHeader } from '@/components/ui/secondary-header';

export default async function ProfilePage() {
    const accountId = await getActiveAccountId();
    if (!accountId) {
        notFound();
    }
    
    const [accountType, canViewProfile] = await Promise.all([
        getAccountType(accountId),
        checkPermissions(['profile.view'])
    ]);

    if (!canViewProfile) {
        notFound();
    }

    const isBrand = accountType === 'brand' || accountType === 'branch';

    return (
        <div className="space-y-8">
            <SecondaryHeader
                title={isBrand ? "Brand Information" : "Personal Information"}
                description={isBrand ? "Manage your brand's public profile and legal details." : "Manage your personal details and contact information."}
            />
            
            {isBrand ? (
                <BrandProfileForm accountId={accountId} />
            ) : (
                <IndividualProfileForm accountId={accountId} />
            )}
        </div>
    )
}

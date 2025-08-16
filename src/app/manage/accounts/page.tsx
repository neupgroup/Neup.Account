
import Link from 'next/link';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronRight,
  Building,
  UserPlus,
  BotMessageSquare,
  Network
} from 'lucide-react';
import { getActiveAccountId } from '@/lib/auth-actions';
import { getAccountType } from '@/lib/user-actions';
import { AccountList } from '@/app/auth/accounts/account-list';
import { notFound } from 'next/navigation';
import { getStoredAccounts } from '@/lib/auth-actions';
import { getBrandAccounts } from '@/app/manage/accounts/brand/actions';
import { cookies } from 'next/headers';
import { getPersonalAccountId } from '@/lib/user-actions';


const FeatureListItem = ({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) => (
  <Link
    href={href}
    className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50"
  >
    <Icon className="h-6 w-6 text-muted-foreground" />
    <div className="flex-grow">
      <p className="font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    <ChevronRight className="h-5 w-5 text-muted-foreground" />
  </Link>
);

const IndividualAccountFeatures = () => (
  <>
    <FeatureListItem
      icon={BotMessageSquare}
      title="Link WhatsApp Account"
      description="Connect your WhatsApp for notifications and services."
      href="/manage/accounts/whatsapp"
    />
    <FeatureListItem
      icon={Building}
      title="Manage Brand Accounts"
      description="Create or manage brand profiles for businesses or organizations."
      href="/manage/accounts/brand"
    />
    <FeatureListItem
      icon={UserPlus}
      title="Create Dependent Account"
      description="Create and manage accounts for family members."
      href="/manage/accounts/dependent/create"
    />
  </>
);

const BrandAccountFeatures = () => (
  <>
     <FeatureListItem
      icon={Network}
      title="Manage Branches"
      description="Add or manage sub-brands and locations."
      href="/manage/accounts/branches"
    />
    <FeatureListItem
      icon={BotMessageSquare}
      title="Link WhatsApp Account"
      description="Connect a WhatsApp Business account for this brand."
      href="/manage/accounts/whatsapp"
    />
  </>
);

const BranchAccountFeatures = () => (
    <FeatureListItem
      icon={BotMessageSquare}
      title="Link WhatsApp Account"
      description="Connect a WhatsApp Business account for this branch."
      href="/manage/accounts/whatsapp"
    />
);


export default async function AccountsPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    notFound();
  }

  const accountType = await getAccountType(accountId);
  const cookieStore = cookies();
  const isManaging = !!cookieStore.get('auth_managing')?.value;
  const personalAccountId = await getPersonalAccountId();

  let accountsToShow = [];

  if (isManaging && personalAccountId) {
    // If managing, only show the primary account to switch back to.
    const storedAccounts = await getStoredAccounts();
    accountsToShow = storedAccounts.filter(acc => acc.accountId === personalAccountId);
  } else {
    // If on the primary account, show all stored accounts (excluding self) and brand accounts.
    const storedAccounts = await getStoredAccounts();
    const brandAccounts = await getBrandAccounts();

    const personalAccounts = storedAccounts.filter(acc => acc.accountId !== personalAccountId);
    
    const mappedBrandAccounts = brandAccounts.map(brand => ({
        accountId: brand.id,
        sessionId: '', 
        sessionKey: '', 
        expired: false,
        isBrand: true,
        displayName: brand.name,
        displayPhoto: brand.logoUrl,
        plan: brand.plan,
    }));
    
    accountsToShow = [...personalAccounts, ...mappedBrandAccounts];
  }
  
  const renderFeatures = () => {
    switch (accountType) {
        case 'brand':
            return <BrandAccountFeatures />;
        case 'branch':
            return <BranchAccountFeatures />;
        case 'individual':
        default:
            return <IndividualAccountFeatures />;
    }
  }


  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Linked Accounts</h1>
        <p className="text-muted-foreground">
          Manage your connections, create new accounts, and switch between them.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Actions</h2>
        <p className="text-muted-foreground text-sm">
          Create new accounts or link services.
        </p>
        <Card>
          <CardContent className="divide-y p-2">
            {renderFeatures()}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Manage Accounts</h2>
        <p className="text-muted-foreground text-sm">
          {isManaging ? "Switch back to your primary account." : "Switch between your NeupID accounts stored on this device."}
        </p>
        <Card>
          <CardContent className="p-0">
            <AccountList 
              accounts={accountsToShow} 
              mode="switch"
              isPaginated={!isManaging}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

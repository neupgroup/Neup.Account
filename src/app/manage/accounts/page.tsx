

import Link from 'next/link';
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Building,
  UserPlus,
  BotMessageSquare,
  Network
} from 'lucide-react';
import { getActiveAccountId, getPersonalAccountId } from '@/lib/auth-actions';
import { getAccountType } from '@/lib/user';
import { AccountList } from '@/app/auth/accounts/account-list';
import { notFound } from 'next/navigation';
import { getStoredAccounts } from '@/lib/session';
import { getBrandAccounts } from '@/actions/manage/accounts/brand';
import { getDependentAccounts } from '@/actions/manage/accounts/dependent';
import { cookies } from 'next/headers';
import { ListItem } from '@/components/ui/list-item';
import { SecondaryHeader } from '@/components/ui/secondary-header';


const IndividualAccountFeatures = () => (
  <>
    <ListItem
      icon={BotMessageSquare}
      title="Link WhatsApp Account"
      description="Connect your WhatsApp for notifications and services."
      href="/manage/accounts/whatsapp"
    />
    <ListItem
      icon={Building}
      title="Manage Brand Accounts"
      description="Create or manage brand profiles for businesses or organizations."
      href="/manage/accounts/brand"
    />
    <ListItem
      icon={UserPlus}
      title="Manage Dependent Accounts"
      description="Create and manage accounts for family members."
      href="/manage/accounts/dependent"
    />
  </>
);

const BrandAccountFeatures = () => (
  <>
     <ListItem
      icon={Network}
      title="Manage Branches"
      description="Add or manage sub-brands and locations."
      href="/manage/accounts/branches"
    />
    <ListItem
      icon={BotMessageSquare}
      title="Link WhatsApp Account"
      description="Connect a WhatsApp Business account for this brand."
      href="/manage/accounts/whatsapp"
    />
  </>
);

const BranchAccountFeatures = () => (
    <ListItem
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
    // If on the primary account, show all stored accounts (excluding self) and brand/dependent accounts.
    const [storedAccounts, brandAccounts, dependentAccounts] = await Promise.all([
        getStoredAccounts(),
        getBrandAccounts(),
        getDependentAccounts(),
    ]);

    const personalAccounts = storedAccounts.filter(acc => acc.accountId !== personalAccountId && !acc.isBrand);
    
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

    const mappedDependentAccounts = dependentAccounts.map(acc => ({
        accountId: acc.id,
        sessionId: '', 
        sessionKey: '', 
        expired: false,
        displayName: acc.displayName,
        neupId: acc.neupId,
        displayPhoto: acc.displayPhoto,
    }));
    
    accountsToShow = [...personalAccounts, ...mappedBrandAccounts, ...mappedDependentAccounts];
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
    <div className="grid gap-4">
      <SecondaryHeader 
        title="Manage Accounts"
        description="Manage your connections, create new accounts, and switch between them."
      />

      <Card>
        <CardContent className="divide-y p-0">
          {renderFeatures()}
           <div className="p-0">
             <AccountList 
                accounts={accountsToShow} 
                mode="switch"
                isPaginated={!isManaging}
            />
           </div>
        </CardContent>
      </Card>
    </div>
  );
}



import { Card, CardContent } from '@/components/ui/card';
import React from 'react';
import { getActiveAccountId, getPersonalAccountId } from '@/lib/auth-actions';
import { getAccountType } from '@/lib/user';
import { notFound } from 'next/navigation';
import { getStoredAccounts } from '@/lib/session';
import { getBrandAccounts } from '@/actions/manage/accounts/brand';
import { getDependentAccounts } from '@/actions/manage/accounts/dependent';
import { cookies } from 'next/headers';
import { ListItem } from '@/components/ui/list-item';
import { SecondaryHeader } from '@/components/ui/secondary-header';
import { Bot, Building, UserPlus, FolderGit2 } from '@/components/icons';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { AccountListItem } from '@/app/auth/accounts/account-list-item';


const LinkAndCreateFeatures = () => (
  <>
    <ListItem
      icon={FolderGit2}
      title="Link Other Accounts"
      description="Connect third-party platforms like WhatsApp."
      href="/manage/accounts/link"
    />
    <ListItem
      icon={Building}
      title="Create Brand Account"
      description="Set up a new profile for a business or organization."
      href="/manage/accounts/brand/create"
    />
    <ListItem
      icon={UserPlus}
      title="Create Dependent Account"
      description="Create and manage an account for a family member."
      href="/manage/accounts/dependent/create"
    />
  </>
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

  // If managing, we don't need to show other accounts, just the management features.
  // The primary logic for showing manageable accounts lives on the personal account dashboard.
  if (!isManaging) {
     const [storedAccounts, brandAccounts, dependentAccounts] = await Promise.all([
        getStoredAccounts(),
        getBrandAccounts(),
        getDependentAccounts(),
    ]);

    const otherPersonalAccounts = storedAccounts.filter(acc => acc.accountId !== personalAccountId && !acc.isBrand);

    const mappedBrandAccounts = brandAccounts.map(brand => ({
        accountId: brand.id,
        sessionId: '',
        sessionKey: '', 
        expired: false,
        isBrand: true,
        displayName: brand.name,
        neupId: `brand`, // Placeholder
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
        isDependent: true,
    }));
    
    accountsToShow = [...otherPersonalAccounts, ...mappedBrandAccounts, ...mappedDependentAccounts];
  }
  
  return (
    <div className="grid gap-8">
      <PrimaryHeader 
        title="Accounts"
        description="Manage your connections, create new accounts, and switch between them."
      />

       <div className="space-y-2">
            <SecondaryHeader 
                title="Link & Create Accounts"
                description="Add new brand or dependent accounts to your profile."
            />
            <Card>
                <CardContent className="divide-y p-0">
                    <LinkAndCreateFeatures />
                </CardContent>
            </Card>
        </div>

        {!isManaging && (
            <div className="space-y-2">
                <SecondaryHeader 
                    title="Manage Accounts"
                    description="Switch to another account you have access to."
                />
                <Card>
                    <CardContent className="p-0 divide-y">
                        {accountsToShow.map((acc: any) => (
                           <AccountListItem key={acc.accountId} account={acc} mode="switch" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        )}
    </div>
  );
}

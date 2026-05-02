import { Card, CardContent } from '@/components/ui/card';
import React from 'react';
import { getActiveAccountId } from '@/core/auth/session';
import { notFound } from 'next/navigation';
import { getAccessibleAccounts } from '@/services/manage/accounts/accessible';
import { authCookies } from '@/core/helpers/cookies';
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
      href="/accounts/link"
    />
    <ListItem
      icon={Building}
      title="Create Brand Account"
      description="Set up a new profile for a business or organization."
      href="/accounts/brand/create"
    />
    <ListItem
      icon={UserPlus}
      title="Create Dependent Account"
      description="Create and manage an account for a family member."
      href="/accounts/dependent/create"
    />
  </>
);


export default async function AccountsPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    notFound();
  }

  const isManaging = Boolean(await authCookies.get('auth_managing'));

  let accountsToShow: any[] = [];

  // If managing, we don't need to show other accounts, just the management features.
  // The primary logic for showing manageable accounts lives on the personal account dashboard.
  if (!isManaging) {
    accountsToShow = await getAccessibleAccounts();
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
              {accountsToShow.length > 0 ? (
                accountsToShow.map((acc: any) => (
                  <AccountListItem key={acc.accountId} account={acc} />
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No other accounts found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

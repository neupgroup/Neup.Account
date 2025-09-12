

import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { getUserDetails } from '@/actions/root/users';
import { checkPermissions } from '@/lib/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { VerifiedBadge } from '@/components/verified-badge';

const accountManagementFeatures = (accountId: string) => [
  {
    icon: 'UserCircle',
    title: 'Profile Information',
    description: 'View and manage user profile details.',
    href: `/manage/root/accounts/${accountId}/profile`,
  },
  {
    icon: 'ShieldCheck',
    title: 'Permissions',
    description: 'Assign or restrict permission sets for this user.',
    href: `/manage/root/accounts/${accountId}/permissions`,
  },
  {
    icon: 'History',
    title: 'Account Activity',
    description: 'View a log of recent actions performed on this account.',
    href: `/manage/root/accounts/${accountId}/activity`,
  },
];

const adminActions = (accountId: string) => [
    {
        icon: 'ShieldCheck',
        title: 'Verification',
        description: 'Manage the user\'s verified status.',
        href: `/manage/root/accounts/${accountId}/verification`,
    },
    {
        icon: 'Ban',
        title: 'Bans & Warnings',
        description: 'Send warnings, block access, or take other admin actions.',
        href: `/manage/root/accounts/${accountId}/notice`,
    },
    {
        icon: 'Trash2',
        title: 'Deletion',
        description: 'Manage the account deletion process.',
        href: `/manage/root/accounts/${accountId}/deletion`,
    },
    {
        icon: 'Gem',
        title: 'Neup.Pro',
        description: 'Activate or deactivate the user\'s Pro subscription.',
        href: `/manage/root/accounts/${accountId}/pro`,
    }
]

export default async function AccountDetailsPage({ params }: { params: { id: string } }) {
  const canView = await checkPermissions([
    'root.account.view_full',
    'root.account.view_limited1',
    'root.account.view_limited2',
  ]);
  if (!canView) {
    notFound();
  }

  const userDetails = await getUserDetails(params.id);

  if (!userDetails) {
    notFound();
  }

  const features = accountManagementFeatures(params.id);
  const adminFeatures = adminActions(params.id);

  return (
    <div className="grid gap-8">
      <BackButton href="/manage/root/accounts/list" />
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage
            src={userDetails.profile.accountPhoto}
            alt={userDetails.profile.nameDisplay}
            data-ai-hint="person"
          />
          <AvatarFallback className="text-xl">
            {userDetails.profile.nameFirst?.[0] ?? ''}
            {userDetails.profile.nameLast?.[0] ?? ''}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {userDetails.profile.nameDisplay ||
                `${userDetails.profile.nameFirst} ${userDetails.profile.nameLast}`}
            </h1>
            {userDetails.profile.verified && <VerifiedBadge accountId={params.id} className="h-6 w-6" />}
          </div>
          <p className="text-muted-foreground font-mono">
            @{userDetails.neupId}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {features.map((feature, index) => (
            <ListItem
              key={index}
              href={feature.href}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </CardContent>
      </Card>
      
       <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Administration Actions</h2>
             <Card>
                <CardContent className="divide-y p-0">
                {adminFeatures.map((feature, index) => (
                    <ListItem
                    key={index}
                    href={feature.href}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    />
                ))}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

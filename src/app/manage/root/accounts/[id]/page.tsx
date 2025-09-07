import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { getUserDetails } from '@/actions/root/users';
import { checkPermissions } from '@/lib/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BackButton } from '@/components/ui/back-button';
import { VerifiedBadge } from '@/components/verified-badge';

const managementFeatures = (accountId: string) => [
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
  {
    icon: 'AlertTriangle',
    title: 'Administrative Actions',
    description: 'Send warnings, block access, or take other admin actions.',
    href: `/manage/root/accounts/${accountId}/notice`,
  },
];

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

  const features = managementFeatures(params.id);

  return (
    <div className="grid gap-8">
      <BackButton href="/manage/root/accounts/list" />
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage
            src={userDetails.profile.displayPhoto}
            alt={userDetails.profile.displayName}
            data-ai-hint="person"
          />
          <AvatarFallback className="text-xl">
            {userDetails.profile.firstName?.[0] ?? ''}
            {userDetails.profile.lastName?.[0] ?? ''}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {userDetails.profile.displayName ||
                `${userDetails.profile.firstName} ${userDetails.profile.lastName}`}
            </h1>
            <VerifiedBadge accountId={params.id} />
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
    </div>
  );
}

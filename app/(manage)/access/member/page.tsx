import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, UserCircle } from '@/components/icons';
import {
  addMemberToAssetGroupFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { getDirectAccessGroup } from '@/services/manage/access';
import { getActiveAccountId } from '@/core/auth/verify';
import { getUserProfile } from '@/services/user';
import { AddMemberForm } from '../_components/add-member-form';
import { AddUserForm } from '../add-user-form';
import { FlowLink } from '@/components/ui/flow-link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { SecondaryHeader } from '@/components/ui/secondary-header';
import { ChevronRight } from '@/components/icons';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

// ── Portfolio members view ────────────────────────────────────────────────────

async function PortfolioAccountPage({ id }: { id: string }) {
  const group = await getAccessAssetGroup(id);
  if (!group) notFound();

  const memberProfiles = await Promise.all(
    group.members.map(async (member) => {
      const profile = await getUserProfile(member.accountId);
      const name =
        profile?.nameDisplay ||
        (profile?.nameFirst || profile?.nameLast
          ? `${profile.nameFirst ?? ''} ${profile.nameLast ?? ''}`.trim()
          : null) ||
        member.accountId;
      return { id: member.id, accountId: member.accountId, name };
    })
  );

  const addMemberAction = addMemberToAssetGroupFromForm.bind(null, id);

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${id}`} />

      <PrimaryHeader
        title="Members with Access"
        description={`Members with access to Portfolio "${group.name}"`}
      />

      <div className="space-y-2">
        <SecondaryHeader
          title="Portfolio Members"
          description="People who have access to this portfolio."
        />

        <AddMemberForm action={addMemberAction} />

        {/* Members card */}
        <Card>
          <CardContent className="divide-y p-2">
            {memberProfiles.length > 0 ? (
              memberProfiles.map((member) => (
                <FlowLink
                  key={member.id}
                  href={`/access?portfolio=${id}&member=${member.accountId}`}
                  className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-grow">
                    <p className="font-medium text-foreground truncate">{member.name}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </FlowLink>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </span>
                <p className="font-medium">No members yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Add a member above using their NeupID.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Direct access members view (no portfolio) ─────────────────────────────────

async function DirectAccountPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const group = await getDirectAccessGroup(accountId);
  if (!group) notFound();

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      <PrimaryHeader
        title="Members with Access"
        description={`Members with access to Profile "${group.name}"`}
      />

      <div className="space-y-2">
        <AddUserForm />

        {/* Members card */}
        <Card>
          <CardContent className="divide-y p-2">
            {group.members.length > 0 ? (
              group.members.map((member) => (
                <FlowLink
                  key={member.id}
                  href={`/access/${member.id}`}
                  className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-grow">
                    <p className="font-medium text-foreground truncate">{member.displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">{member.subtitle}</p>
                  </div>
                </FlowLink>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </span>
                <p className="font-medium">No members yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Use the form above to invite someone by NeupID.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default async function MemberPage({ searchParams }: PageProps) {
  const { portfolio: id } = await searchParams;

  if (id) {
    return <PortfolioAccountPage id={id} />;
  }

  return <DirectAccountPage />;
}

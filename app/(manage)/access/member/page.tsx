import { notFound } from 'next/navigation';
import Image from 'next/image';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ChevronRight } from '@/components/icons';
import { addMemberToAssetGroupFromForm } from '@/services/manage/access/actions';
import { getPortfolioMembers, getDirectMembers } from '@/services/manage/access';
import { getActiveAccountId } from '@/core/auth/verify';
import { AddMemberForm } from '../_components/add-member-form';
import { AddUserForm } from '../add-user-form';
import { FlowLink } from '@/components/ui/flow-link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { SecondaryHeader } from '@/components/ui/secondary-header';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

// ── Shared member row ─────────────────────────────────────────────────────────

function MemberRow({
  href,
  displayName,
  accountPhoto,
  roleCount,
}: {
  href: string;
  displayName: string;
  accountPhoto?: string;
  roleCount: number;
}) {
  return (
    <FlowLink
      href={href}
      className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden">
        {accountPhoto ? (
          <Image
            src={accountPhoto}
            alt={displayName}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-grow">
        <p className="font-medium text-foreground truncate">{displayName}</p>
        <p className="text-sm text-muted-foreground">
          {roleCount === 0
            ? 'No roles assigned'
            : `${roleCount} role${roleCount !== 1 ? 's' : ''} assigned`}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </FlowLink>
  );
}

// ── Portfolio members view ────────────────────────────────────────────────────

async function PortfolioAccountPage({ id }: { id: string }) {
  const { portfolioName, members } = await getPortfolioMembers(id);
  if (!portfolioName) notFound();

  const addMemberAction = addMemberToAssetGroupFromForm.bind(null, id);

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${id}`} />

      <PrimaryHeader
        title="Members with Access"
        description={`Members with access to Portfolio "${portfolioName}"`}
      />

      <div className="space-y-2">
        <SecondaryHeader
          title="Portfolio Members"
          description="People who have access to this portfolio."
        />

        <AddMemberForm action={addMemberAction} />

        <Card>
          <CardContent className="divide-y p-2">
            {members.length > 0 ? (
              members.map((member) => (
                <MemberRow
                  key={member.accountId}
                  href={`/access/role?portfolio=${id}&member=${member.accountId}`}
                  displayName={member.displayName}
                  accountPhoto={member.accountPhoto}
                  roleCount={member.roleCount}
                />
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

  const { accountName, members } = await getDirectMembers(accountId);

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      <PrimaryHeader
        title="Members with Access"
        description={`Members with access to Profile "${accountName}"`}
      />

      <div className="space-y-2">
        <AddUserForm />

        <Card>
          <CardContent className="divide-y p-2">
            {members.length > 0 ? (
              members.map((member) => (
                <MemberRow
                  key={member.accountId}
                  href={`/access/role?member=${member.accountId}`}
                  displayName={member.displayName}
                  accountPhoto={member.accountPhoto}
                  roleCount={member.roleCount}
                />
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

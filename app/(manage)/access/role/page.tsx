import { notFound } from 'next/navigation';
import Image from 'next/image';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCircle } from '@/components/icons';
import { getActiveAccountId } from '@/core/auth/verify';
import { getUserProfile } from '@/services/user';
import prisma from '@/core/helpers/prisma';
import {
  getDirectMemberDetail,
  getPortfolioMemberDetail,
  getMyDirectRoles,
  getMyPortfolioRoles,
} from '@/services/manage/access';
import { RemoveMemberButton } from '../_components/remove-member-button';
import {
  removeDirectMember,
  cancelDirectInvitation,
  removePortfolioMember,
  cancelPortfolioInvitation,
} from '../_components/actions';

type PageProps = {
  searchParams: Promise<{ member?: string; portfolio?: string }>;
};

const NEUPID_LOGO = 'https://neupgroup.com/assets/branding/neup.group/logo.svg';
const FALLBACK_PHOTO = 'https://neupgroup.com/assets/user.png';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hasPendingDirectInvitation(
  senderAccountId: string,
  recipientAccountId: string,
): Promise<boolean> {
  const req = await prisma.request.findFirst({
    where: {
      action: 'access_invitation',
      senderId: senderAccountId,
      recipientId: recipientAccountId,
      status: 'pending',
    },
    select: { id: true },
  });
  return req !== null;
}

async function hasPendingPortfolioInvitation(
  senderAccountId: string,
  recipientAccountId: string,
  portfolioId: string,
): Promise<boolean> {
  const reqs = await prisma.request.findMany({
    where: {
      action: 'access_invitation',
      senderId: senderAccountId,
      recipientId: recipientAccountId,
      status: 'pending',
    },
    select: { data: true },
  });
  return reqs.some(
    (r) => (r.data as Record<string, unknown> | null)?.portfolioId === portfolioId,
  );
}

/** Returns true if the given member is the portfolio owner (hasFullAccess: true). */
async function isPortfolioOwner(portfolioId: string, memberAccountId: string): Promise<boolean> {
  const member = await prisma.portfolioMember.findFirst({
    where: { portfolioId, accountId: memberAccountId },
    select: { hasFullAccess: true },
  });
  return member?.hasFullAccess === true;
}

// ── Platform avatar ───────────────────────────────────────────────────────────

function PlatformAvatar({
  userPhoto,
  platformLogo,
  platformName,
}: {
  userPhoto: string;
  platformLogo: string;
  platformName: string;
}) {
  return (
    <div className="relative shrink-0 h-14 w-14">
      <span className="flex h-14 w-14 rounded-full overflow-hidden bg-muted">
        <Image src={userPhoto} alt="User photo" width={56} height={56} className="h-full w-full object-cover" />
      </span>
      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background overflow-hidden">
        <Image src={platformLogo} alt={platformName} width={20} height={20} className="h-full w-full object-contain" />
      </span>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────

function PageHeader({
  photo,
  displayName,
  description,
}: {
  photo: string;
  displayName: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 rounded-lg overflow-hidden bg-muted border">
        <Image src={photo} alt={displayName} width={72} height={72} className="h-18 w-18 object-cover" />
      </span>
      <div>
        <p className="text-lg font-semibold">{displayName}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Role card ─────────────────────────────────────────────────────────────────

function RoleCard({
  platformLabel,
  contextName,
  roleName,
  roleDescription,
  avatar,
}: {
  platformLabel: string;
  contextName?: string;
  roleName: string;
  roleDescription?: string;
  avatar?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {avatar}
      <div className="grid gap-1 min-w-0">
        {avatar ? (
          contextName && <p className="text-base font-semibold">{contextName}</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold capitalize">{platformLabel}</span>
            {contextName && (
              <Badge variant="secondary" className="text-xs font-normal">{contextName}</Badge>
            )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{roleName}</span>
          {roleDescription && (
            <>
              <span className="mx-1.5 text-muted-foreground/60">&middot;</span>
              {roleDescription}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRoles({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UserCircle className="h-6 w-6 text-muted-foreground" />
        </span>
        <p className="font-medium">No roles assigned</p>
        <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      </CardContent>
    </Card>
  );
}

// ── /access/role — my own roles on my account ─────────────────────────────────

async function MyDirectRolesView() {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const [data, profile] = await Promise.all([
    getMyDirectRoles(accountId),
    getUserProfile(accountId),
  ]);
  if (!data) notFound();

  const userPhoto = profile?.accountPhoto ?? FALLBACK_PHOTO;
  const displayName = profile?.nameDisplay ?? data.myName;

  const avatar = (
    <PlatformAvatar userPhoto={userPhoto} platformLogo={NEUPID_LOGO} platformName="NeupID" />
  );

  return (
    <div className="grid gap-6">
      <BackButton href="/access" />
      <PageHeader
        photo={userPhoto}
        displayName={displayName}
        description={<>Roles assigned to <span className="font-medium text-foreground">{displayName}</span> for account of <span className="font-medium text-foreground">{data.ownerName}</span></>}
      />
      {data.roles.length > 0 ? (
        <Card>
          <CardContent className="divide-y p-0">
            {data.roles.map((role, i) => (
              <RoleCard
                key={`${role.roleId}-${i}`}
                platformLabel="NeupID"
                contextName={displayName}
                roleName={role.roleName}
                roleDescription={role.roleDescription}
                avatar={avatar}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyRoles message="You have no direct roles assigned on this account." />
      )}
    </div>
  );
}

// ── /access/role?portfolio=[id] — my own roles on a portfolio ─────────────────

async function MyPortfolioRolesView({ portfolioId }: { portfolioId: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const [data, profile] = await Promise.all([
    getMyPortfolioRoles(portfolioId),
    getUserProfile(accountId),
  ]);
  if (!data) notFound();

  const userPhoto = profile?.accountPhoto ?? FALLBACK_PHOTO;
  const displayName = profile?.nameDisplay ?? data.myName;

  return (
    <div className="grid gap-6">
      <BackButton href={`/access?portfolio=${portfolioId}`} />
      <PageHeader
        photo={userPhoto}
        displayName={displayName}
        description={<>Role assigned to <span className="font-medium text-foreground">{displayName}</span> on portfolio <span className="font-medium text-foreground">{data.portfolioName}</span></>}
      />
      {data.roles.length > 0 ? (
        <Card>
          <CardContent className="divide-y p-0">
            {data.roles.map((role, i) => (
              <RoleCard
                key={`${role.roleId}-${i}`}
                platformLabel={role.assetType.replace(/_/g, ' ')}
                contextName={role.assetName}
                roleName={role.roleName}
                roleDescription={role.roleDescription}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyRoles message="You have no roles assigned on assets in this portfolio." />
      )}
    </div>
  );
}

// ── /access/role?member=[id] — a member's roles on my account ────────────────

async function MemberDirectRolesView({ memberAccountId }: { memberAccountId: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const [detail, ownerProfile, isPending] = await Promise.all([
    getDirectMemberDetail(accountId, memberAccountId),
    getUserProfile(accountId),
    hasPendingDirectInvitation(accountId, memberAccountId),
  ]);
  if (!detail) notFound();

  const userPhoto = detail.accountPhoto ?? FALLBACK_PHOTO;
  const ownerName = ownerProfile?.nameDisplay ?? accountId;

  // Nobody can remove the account owner's own direct roles — not delegates, not themselves.
  const isOwnerAccount = memberAccountId === accountId;
  const canRemove = !isOwnerAccount;

  const avatar = (
    <PlatformAvatar userPhoto={userPhoto} platformLogo={NEUPID_LOGO} platformName="NeupID" />
  );

  return (
    <div className="grid gap-6">
      <BackButton href="/access/member" />

      <PageHeader
        photo={userPhoto}
        displayName={detail.displayName}
        description={<>Roles assigned to <span className="font-medium text-foreground">{detail.displayName}</span> for account of <span className="font-medium text-foreground">{ownerName}</span></>}
      />

      {detail.roles.length > 0 ? (
        <Card>
          <CardContent className="divide-y p-0">
            {detail.roles.map((role, i) => (
              <RoleCard
                key={`${role.roleId}-${i}`}
                platformLabel="NeupID"
                contextName={detail.displayName}
                roleName={role.roleName}
                roleDescription={role.roleDescription}
                avatar={avatar}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyRoles message="This member has no roles assigned on your account." />
      )}

      {canRemove && (
        <div className="flex justify-start">
          {isPending ? (
            <RemoveMemberButton
              label="Cancel Invitation"
              confirmTitle="Cancel invitation?"
              confirmDescription={`This will cancel the pending access invitation sent to ${detail.displayName}. They will no longer be able to accept it.`}
              action={cancelDirectInvitation.bind(null, memberAccountId)}
              redirectTo="/access/member"
              variant="outline"
            />
          ) : (
            <RemoveMemberButton
              label="Remove All Access"
              confirmTitle="Remove all access?"
              confirmDescription={`This will remove all roles ${detail.displayName} holds on your account. This cannot be undone.`}
              action={removeDirectMember.bind(null, memberAccountId)}
              redirectTo="/access/member"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── /access/role?member=[id]&portfolio=[id] — a member's roles on a portfolio ─

async function MemberPortfolioRolesView({
  memberAccountId,
  portfolioId,
}: {
  memberAccountId: string;
  portfolioId: string;
}) {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const [detail, memberProfile, isPending, isOwner] = await Promise.all([
    getPortfolioMemberDetail(portfolioId, memberAccountId),
    getUserProfile(memberAccountId),
    hasPendingPortfolioInvitation(accountId, memberAccountId, portfolioId),
    isPortfolioOwner(portfolioId, memberAccountId),
  ]);
  if (!detail) notFound();

  const userPhoto = memberProfile?.accountPhoto ?? FALLBACK_PHOTO;

  return (
    <div className="grid gap-6">
      <BackButton href={`/access/member?portfolio=${portfolioId}`} />

      <PageHeader
        photo={userPhoto}
        displayName={detail.displayName}
        description={<>Role assigned to <span className="font-medium text-foreground">{detail.displayName}</span> on portfolio <span className="font-medium text-foreground">{detail.portfolioName}</span></>}
      />

      {detail.roles.length > 0 ? (
        <Card>
          <CardContent className="divide-y p-0">
            {detail.roles.map((role, i) => (
              <RoleCard
                key={`${role.roleId}-${i}`}
                platformLabel={role.assetType.replace(/_/g, ' ')}
                contextName={role.assetName}
                roleName={role.roleName}
                roleDescription={role.roleDescription}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyRoles message="This member has no roles assigned on assets in this portfolio." />
      )}

      {!isOwner && (
        <div className="flex justify-start">
          {isPending ? (
            <RemoveMemberButton
              label="Cancel Invitation"
              confirmTitle="Cancel invitation?"
              confirmDescription={`This will cancel the pending invitation for ${detail.displayName} to join portfolio "${detail.portfolioName}".`}
              action={cancelPortfolioInvitation.bind(null, portfolioId, memberAccountId)}
              redirectTo={`/access/member?portfolio=${portfolioId}`}
              variant="outline"
            />
          ) : (
            <RemoveMemberButton
              label="Remove from Portfolio"
              confirmTitle="Remove from portfolio?"
              confirmDescription={`This will remove ${detail.displayName} from portfolio "${detail.portfolioName}" and revoke all their asset roles within it.`}
              action={removePortfolioMember.bind(null, portfolioId, memberAccountId)}
              redirectTo={`/access/member?portfolio=${portfolioId}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default async function RolePage({ searchParams }: PageProps) {
  const { member: memberAccountId, portfolio: portfolioId } = await searchParams;

  // /access/role?member=[id]&portfolio=[id]
  if (memberAccountId && portfolioId) {
    return <MemberPortfolioRolesView memberAccountId={memberAccountId} portfolioId={portfolioId} />;
  }

  // /access/role?member=[id]
  if (memberAccountId) {
    return <MemberDirectRolesView memberAccountId={memberAccountId} />;
  }

  // /access/role?portfolio=[id]
  if (portfolioId) {
    return <MyPortfolioRolesView portfolioId={portfolioId} />;
  }

  // /access/role
  return <MyDirectRolesView />;
}

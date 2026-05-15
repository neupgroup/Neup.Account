import { notFound } from 'next/navigation';
import Image from 'next/image';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCircle } from '@/components/icons';
import { getActiveAccountId } from '@/core/auth/verify';
import { getUserProfile, getUserNeupIds } from '@/services/user';
import {
  getDirectMemberDetail,
  getPortfolioMemberDetail,
  getMyDirectRoles,
  getMyPortfolioRoles,
} from '@/services/manage/access';

type PageProps = {
  searchParams: Promise<{ member?: string; portfolio?: string }>;
};

const NEUPID_LOGO = 'https://neupgroup.com/assets/branding/neup.group/logo.svg';
const FALLBACK_PHOTO = 'https://neupgroup.com/assets/user.png';

// ── Platform avatar ───────────────────────────────────────────────────────────
// Large circular user photo with a smaller platform logo badge at bottom-right.

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
      {/* Main user photo */}
      <span className="flex h-14 w-14 rounded-full overflow-hidden bg-muted">
        <Image
          src={userPhoto}
          alt="User photo"
          width={56}
          height={56}
          className="h-full w-full object-cover"
        />
      </span>

      {/* Platform badge — bottom-right */}
      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background overflow-hidden">
        <Image
          src={platformLogo}
          alt={platformName}
          width={20}
          height={20}
          className="h-full w-full object-contain"
        />
      </span>
    </div>
  );
}

// ── Role card ─────────────────────────────────────────────────────────────────
//
// Layout:
//   [Avatar?]  Platform / asset type  [Tag]
//              roleName · description

function RoleCard({
  platformLabel,
  tag,
  roleName,
  roleDescription,
  avatar,
}: {
  platformLabel: string;
  tag?: string;
  roleName: string;
  roleDescription?: string;
  avatar?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3 flex items-center gap-4">
        {avatar}

        <div className="grid gap-1 min-w-0">
          {/* Platform row */}
          <div className="flex items-center gap-2 flex-wrap">
            {!avatar && (
              <span className="text-base font-semibold capitalize">{platformLabel}</span>
            )}
            {tag && (
              <Badge variant="secondary" className="text-xs font-normal">
                {tag}
              </Badge>
            )}
          </div>

          {/* Role row */}
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
      </CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRoles({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <UserCircle className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="font-medium">No roles assigned</p>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}

// ── /access/role — my own roles on my account ─────────────────────────────────

async function MyDirectRolesView() {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const [data, neupIds, profile] = await Promise.all([
    getMyDirectRoles(accountId),
    getUserNeupIds(accountId),
    getUserProfile(accountId),
  ]);
  if (!data) notFound();

  const neupId = neupIds[0];
  const userPhoto = profile?.accountPhoto ?? FALLBACK_PHOTO;

  const avatar = (
    <PlatformAvatar
      userPhoto={userPhoto}
      platformLogo={NEUPID_LOGO}
      platformName="NeupID"
    />
  );

  return (
    <div className="grid gap-4">
      <BackButton href="/access" />

      {data.roles.length > 0 ? (
        <div className="grid gap-3">
          {data.roles.map((role, i) => (
            <RoleCard
              key={`${role.roleId}-${i}`}
              platformLabel="NeupID"
              tag={neupId}
              roleName={role.roleName}
              roleDescription={role.roleDescription}
              avatar={avatar}
            />
          ))}
        </div>
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

  const data = await getMyPortfolioRoles(portfolioId);
  if (!data) notFound();

  return (
    <div className="grid gap-4">
      <BackButton href={`/access?portfolio=${portfolioId}`} />

      {data.roles.length > 0 ? (
        <div className="grid gap-3">
          {data.roles.map((role, i) => (
            <RoleCard
              key={`${role.roleId}-${i}`}
              platformLabel={role.assetType.replace(/_/g, ' ')}
              tag={role.assetName}
              roleName={role.roleName}
              roleDescription={role.roleDescription}
            />
          ))}
        </div>
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

  const [detail, neupIds] = await Promise.all([
    getDirectMemberDetail(accountId, memberAccountId),
    getUserNeupIds(memberAccountId),
  ]);
  if (!detail) notFound();

  const neupId = neupIds[0];
  const userPhoto = detail.accountPhoto ?? FALLBACK_PHOTO;

  const avatar = (
    <PlatformAvatar
      userPhoto={userPhoto}
      platformLogo={NEUPID_LOGO}
      platformName="NeupID"
    />
  );

  return (
    <div className="grid gap-4">
      <BackButton href="/access/member" />

      {detail.roles.length > 0 ? (
        <div className="grid gap-3">
          {detail.roles.map((role, i) => (
            <RoleCard
              key={`${role.roleId}-${i}`}
              platformLabel="NeupID"
              tag={neupId}
              roleName={role.roleName}
              roleDescription={role.roleDescription}
              avatar={avatar}
            />
          ))}
        </div>
      ) : (
        <EmptyRoles message="This member has no roles assigned on your account." />
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
  const detail = await getPortfolioMemberDetail(portfolioId, memberAccountId);
  if (!detail) notFound();

  return (
    <div className="grid gap-4">
      <BackButton href={`/access/member?portfolio=${portfolioId}`} />

      {detail.roles.length > 0 ? (
        <div className="grid gap-3">
          {detail.roles.map((role, i) => (
            <RoleCard
              key={`${role.roleId}-${i}`}
              platformLabel={role.assetType.replace(/_/g, ' ')}
              tag={role.assetName}
              roleName={role.roleName}
              roleDescription={role.roleDescription}
            />
          ))}
        </div>
      ) : (
        <EmptyRoles message="This member has no roles assigned on assets in this portfolio." />
      )}
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default async function RolePage({ searchParams }: PageProps) {
  const { member: memberAccountId, portfolio: portfolioId } = await searchParams;

  // /access/role?member=[id]&portfolio=[id]
  if (memberAccountId && portfolioId) {
    return (
      <MemberPortfolioRolesView
        memberAccountId={memberAccountId}
        portfolioId={portfolioId}
      />
    );
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

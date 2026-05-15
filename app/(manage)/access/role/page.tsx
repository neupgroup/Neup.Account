import { notFound } from 'next/navigation';
import Image from 'next/image';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCircle } from '@/components/icons';
import { getActiveAccountId } from '@/core/auth/verify';
import { getUserProfile } from '@/services/user';
import {
  getDirectMemberDetail,
  getPortfolioMemberDetail,
  getMyDirectRoles,
  getMyPortfolioRoles,
} from '@/services/manage/access';

type PageProps = {
  searchParams: Promise<{ member?: string; portfolio?: string }>;
};

// ── Shared avatar ─────────────────────────────────────────────────────────────

function Avatar({ photo, name, large = false }: { photo?: string; name: string; large?: boolean }) {
  const sizeClass = large ? 'h-12 w-12 text-base' : 'h-9 w-9 text-sm';
  return (
    <span
      className={`shrink-0 flex items-center justify-center rounded-full bg-muted overflow-hidden ${sizeClass}`}
    >
      {photo ? (
        <Image
          src={photo}
          alt={name}
          width={large ? 48 : 36}
          height={large ? 48 : 36}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-medium text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

// ── Shared roles card ─────────────────────────────────────────────────────────

function RolesCard({
  title,
  description,
  roles,
  emptyMessage,
}: {
  title: string;
  description: string;
  roles: {
    roleId: string;
    roleName: string;
    roleDescription?: string;
    assetName?: string;
    assetType?: string;
  }[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        {roles.length > 0 ? (
          <div className="divide-y">
            {roles.map((role, i) => (
              <div key={`${role.roleId}-${i}`} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{role.roleName}</p>
                  {role.roleDescription && (
                    <p className="text-xs text-muted-foreground mt-0.5">{role.roleDescription}</p>
                  )}
                  {role.assetName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      on <span className="font-medium text-foreground">{role.assetName}</span>
                    </p>
                  )}
                </div>
                {role.assetType && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {role.assetType.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <UserCircle className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-medium">No roles assigned</p>
            <p className="text-sm text-muted-foreground max-w-xs">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── /access/role — my own roles on my account ─────────────────────────────────

async function MyDirectRolesView() {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const data = await getMyDirectRoles(accountId);
  if (!data) notFound();

  const myProfile = await getUserProfile(accountId);
  const photo = myProfile?.accountPhoto;

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      <div className="flex items-center gap-4">
        <Avatar photo={photo} name={data.myName} large />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.myName}</h1>
          <p className="text-sm text-muted-foreground">Your roles on this account</p>
        </div>
      </div>

      <RolesCard
        title="Your Roles"
        description="Roles you hold directly on this account."
        roles={data.roles}
        emptyMessage="You have no direct roles assigned on this account."
      />
    </div>
  );
}

// ── /access/role?portfolio=[id] — my own roles on a portfolio ─────────────────

async function MyPortfolioRolesView({ portfolioId }: { portfolioId: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const data = await getMyPortfolioRoles(portfolioId);
  if (!data) notFound();

  const myProfile = await getUserProfile(accountId);
  const photo = myProfile?.accountPhoto;

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${portfolioId}`} />

      <div className="flex items-center gap-4">
        <Avatar photo={photo} name={data.myName} large />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.myName}</h1>
          <p className="text-sm text-muted-foreground">
            Your roles in portfolio &ldquo;{data.portfolioName}&rdquo;
          </p>
        </div>
      </div>

      <RolesCard
        title="Your Roles"
        description={`Roles you hold on assets in portfolio "${data.portfolioName}".`}
        roles={data.roles}
        emptyMessage="You have no roles assigned on assets in this portfolio."
      />
    </div>
  );
}

// ── /access/role?member=[id] — a member's roles on my account ────────────────

async function MemberDirectRolesView({ memberAccountId }: { memberAccountId: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const detail = await getDirectMemberDetail(accountId, memberAccountId);
  if (!detail) notFound();

  return (
    <div className="grid gap-8">
      <BackButton href="/access/member" />

      <div className="flex items-center gap-4">
        <Avatar photo={detail.accountPhoto} name={detail.displayName} large />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{detail.displayName}</h1>
          <p className="text-sm text-muted-foreground">Roles on your account</p>
        </div>
      </div>

      <RolesCard
        title="Assigned Roles"
        description="Roles this member holds directly on your account."
        roles={detail.roles}
        emptyMessage="This member has no roles assigned on your account."
      />
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
    <div className="grid gap-8">
      <BackButton href={`/access/member?portfolio=${portfolioId}`} />

      <div className="flex items-center gap-4">
        <Avatar name={detail.displayName} large />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{detail.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            Roles in portfolio &ldquo;{detail.portfolioName}&rdquo;
          </p>
        </div>
      </div>

      <RolesCard
        title="Assigned Roles"
        description={`Roles this member holds on assets in portfolio "${detail.portfolioName}".`}
        roles={detail.roles}
        emptyMessage="This member has no roles assigned on assets in this portfolio."
      />
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

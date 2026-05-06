import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Database, UserCircle } from '@/components/icons';
import prisma from '@/core/helpers/prisma';
import { getActiveAccountId } from '@/core/auth/verify';
import { resolveAssetName } from '@/services/manage/access/asset-resolvers';
import { getUserProfile } from '@/services/user';

type PageProps = {
  params: Promise<{ id: string; assetId: string }>;
};

async function getAssetMembers(portfolioId: string, portfolioAssetId: string, accountId: string) {
  // Verify access
  const member = await prisma.portfolioMember.findFirst({
    where: { portfolioId, accountId },
    select: { id: true },
  });

  if (!member) return null;

  // Get the asset
  const asset = await prisma.portfolioAsset.findFirst({
    where: { id: portfolioAssetId, portfolioId },
    select: { id: true, assetId: true, assetType: true },
  });

  if (!asset) return null;

  // Get all grants for this asset
  const grants = await prisma.authzAssetsAccessGrant.findMany({
    where: {
      asset_id: portfolioAssetId,
      portfolio_id: portfolioId,
      app_id: 'neup.account',
    },
    select: {
      id: true,
      account_id: true,
      role_id: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
    orderBy: { account_id: 'asc' },
  });

  // Group by account
  const accountMap = new Map<string, { accountId: string; roles: Array<{ id: string; name: string; description?: string }> }>();

  for (const grant of grants) {
    if (!accountMap.has(grant.account_id)) {
      accountMap.set(grant.account_id, {
        accountId: grant.account_id,
        roles: [],
      });
    }
    accountMap.get(grant.account_id)!.roles.push({
      id: grant.role.id,
      name: grant.role.name,
      description: grant.role.description ?? undefined,
    });
  }

  return {
    asset,
    members: Array.from(accountMap.values()),
  };
}

export default async function AssetMembersPage({ params }: PageProps) {
  const { id, assetId } = await params;
  const accountId = await getActiveAccountId();

  if (!accountId) notFound();

  const data = await getAssetMembers(id, assetId, accountId);

  if (!data) notFound();

  const { asset, members } = data;

  // Resolve asset name
  const resolved = await resolveAssetName(asset.assetId, asset.assetType);

  // Resolve member names
  const memberProfiles = await Promise.all(
    members.map(async (m) => {
      const profile = await getUserProfile(m.accountId);
      const name =
        profile?.nameDisplay ||
        (profile?.nameFirst || profile?.nameLast
          ? `${profile.nameFirst ?? ''} ${profile.nameLast ?? ''}`.trim()
          : null) ||
        m.accountId;
      return { ...m, displayName: name };
    })
  );

  return (
    <div className="grid gap-8">
      <BackButton href={`/access/portfolio/${id}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
            <Database className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{resolved.name}</h1>
            <p className="text-sm text-muted-foreground">
              {resolved.subtitle ?? asset.assetType}
            </p>
          </div>
        </div>
        <Badge variant="outline">{asset.assetType}</Badge>
      </div>

      {/* Members with access */}
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Members with access</h2>
          <span className="text-sm text-muted-foreground">{memberProfiles.length} members</span>
        </div>

        {memberProfiles.length === 0 ? (
          <div className="rounded-lg border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No members have been assigned roles for this asset yet.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border divide-y">
            {memberProfiles.map((member) => (
              <div key={member.accountId} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{member.displayName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {member.roles.map((role) => (
                      <Badge
                        key={role.id}
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                        title={role.description}
                      >
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

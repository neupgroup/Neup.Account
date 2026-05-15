import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppWindow, Database, UserCircle, X } from '@/components/icons';
import prisma from '@/core/helpers/prisma';
import { getActiveAccountId } from '@/core/auth/verify';
import {
  addAssetToGroupFromForm,
  removeAssetFromGroupFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { resolveAssetName, resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { getUserProfile } from '@/services/user';
import { AddAssetForm } from '../_components/add-asset-form';
import { FlowLink } from '@/components/ui/flow-link';

type PageProps = {
  searchParams: Promise<{ portfolio?: string; asset?: string }>;
};

// ── Asset detail view ─────────────────────────────────────────────────────────

async function getAssetMembers(portfolioId: string, portfolioAssetId: string, accountId: string) {
  const member = await prisma.portfolioMember.findFirst({
    where: { portfolioId, accountId },
    select: { id: true },
  });
  if (!member) return null;

  const asset = await prisma.portfolioAsset.findFirst({
    where: { id: portfolioAssetId, portfolioId },
    select: { id: true, assetId: true, assetType: true },
  });
  if (!asset) return null;

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
      role: { select: { id: true, name: true, description: true } },
    },
    orderBy: { account_id: 'asc' },
  });

  const accountMap = new Map<
    string,
    { accountId: string; roles: Array<{ id: string; name: string; description?: string }> }
  >();
  for (const grant of grants) {
    if (!accountMap.has(grant.account_id)) {
      accountMap.set(grant.account_id, { accountId: grant.account_id, roles: [] });
    }
    accountMap.get(grant.account_id)!.roles.push({
      id: grant.role.id,
      name: grant.role.name,
      description: grant.role.description ?? undefined,
    });
  }

  return { asset, members: Array.from(accountMap.values()) };
}

async function AssetDetail({ portfolioId, assetId }: { portfolioId: string; assetId: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const data = await getAssetMembers(portfolioId, assetId, accountId);
  if (!data) notFound();

  const { asset, members } = data;
  const resolved = await resolveAssetName(asset.assetId, asset.assetType);

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
      <BackButton href={`/access/asset?portfolio=${portfolioId}`} />

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

// ── Asset list view ───────────────────────────────────────────────────────────

async function AssetList({ portfolioId }: { portfolioId: string }) {
  const group = await getAccessAssetGroup(portfolioId);
  if (!group) notFound();

  const assetNameMap = await resolveAssetNames(group.assets);
  const existingAssetIds = group.assets.map((a) => a.assetId);

  const addAssetAction = addAssetToGroupFromForm.bind(null, portfolioId);
  const removeAssetAction = removeAssetFromGroupFromForm.bind(null, portfolioId);

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${portfolioId}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {group.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the assets available in this portfolio.
          </p>
        </div>
        {group.assets.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            <span>{group.assets.length}</span>
          </div>
        )}
      </div>

      {/* Add asset */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Add Asset</CardTitle>
          <p className="text-xs text-muted-foreground">
            Add a brand account, branch account, or application to this portfolio.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <AddAssetForm action={addAssetAction} existingAssetIds={existingAssetIds} />
          </div>
        </CardContent>
      </Card>

      {/* Application shortcut */}
      {group.assets.some((a) => ['application', 'app'].includes(a.assetType.toLowerCase())) && (
        <FlowLink
          href={`/access/application?portfolio=${portfolioId}`}
          className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <AppWindow className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">View Applications</p>
              <p className="text-xs text-muted-foreground">
                See members and roles per application
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">→</span>
        </FlowLink>
      )}

      {/* Asset list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-muted-foreground" />
            Assets
            {group.assets.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {group.assets.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t divide-y">
            {group.assets.length > 0 ? (
              group.assets.map((asset) => {
                const resolved = assetNameMap[asset.id];
                return (
                  <div
                    key={asset.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </span>

                    <FlowLink
                      href={`/access/asset?portfolio=${portfolioId}&asset=${asset.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="text-sm font-medium truncate">
                        {resolved?.name ?? asset.assetId}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {resolved?.subtitle ?? asset.assetType}
                      </p>
                    </FlowLink>

                    <Badge variant="outline" className="shrink-0 text-xs">
                      {asset.assetType}
                    </Badge>

                    <form action={removeAssetAction}>
                      <input type="hidden" name="portfolioAssetId" value={asset.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${resolved?.name ?? asset.assetId} from portfolio`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Database className="h-6 w-6 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No assets yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Add a brand account, branch account, or application using the picker above.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default async function AssetPage({ searchParams }: PageProps) {
  const { portfolio: portfolioId, asset: assetId } = await searchParams;

  if (!portfolioId) {
    // Direct access context — no portfolio assets
    return (
      <div className="grid gap-8">
        <BackButton href="/access" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assets are managed through portfolios.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">No assets in direct access</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Create a portfolio to manage assets and assign roles to members.
          </p>
        </div>
      </div>
    );
  }

  if (assetId) {
    return <AssetDetail portfolioId={portfolioId} assetId={assetId} />;
  }

  return <AssetList portfolioId={portfolioId} />;
}

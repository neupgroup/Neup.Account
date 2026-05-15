import { notFound } from 'next/navigation';
import { FlowLink } from '@/components/ui/flow-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AppWindow, ChevronRight, FolderGit2 } from '@/components/icons';
import { getDirectAccessGroup } from '@/services/manage/access';
import { getAccessAssetGroups, getAccessAssetGroup } from '@/services/manage/access/assets';
import { getActiveAccountId } from '@/core/auth/verify';
import { getConnectedApplications } from '@/services/applications/connected';
import { getUserProfile } from '@/services/user';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { CreateAssetGroupCard } from './create-asset-group-card';
import {
  AccessGroupView,
  type AccessGroupMember,
  type AccessGroupAsset,
} from './_components/access-group-view';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

// ── Portfolio detail view ─────────────────────────────────────────────────────

async function PortfolioDetail({ id }: { id: string }) {
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
      return { id: member.id, accountId: member.accountId, displayName: name } satisfies AccessGroupMember;
    })
  );

  const assetNameMap = await resolveAssetNames(group.assets);

  const assets: AccessGroupAsset[] = group.assets.map((asset) => ({
    id: asset.id,
    assetId: asset.assetId,
    name: assetNameMap[asset.id]?.name ?? asset.assetId,
    subtitle: assetNameMap[asset.id]?.subtitle ?? asset.assetType,
    assetType: asset.assetType,
  }));

  return (
    <AccessGroupView
      name={group.name}
      description={group.description ?? undefined}
      members={memberProfiles}
      assets={assets}
      backHref="/access"
      accountsHref={`/access/account?portfolio=${id}`}
      assetsHref={`/access/asset?portfolio=${id}`}
      assignHref={`/access/assign?portfolio=${id}`}
      allMembersHref={`/access/account?portfolio=${id}`}
      allAssetsHref={`/access/asset?portfolio=${id}`}
    />
  );
}

// ── Main access page — direct access view + portfolios at the bottom ──────────

export default async function AccessControlPage({ searchParams }: PageProps) {
  const { portfolio: portfolioId } = await searchParams;

  // Portfolio detail — same component, different data source
  if (portfolioId) {
    return <PortfolioDetail id={portfolioId} />;
  }

  const accountId = await getActiveAccountId();

  const [directGroup, portfolios, connectedApps] = await Promise.all([
    accountId ? getDirectAccessGroup(accountId) : null,
    getAccessAssetGroups(),
    getConnectedApplications(),
  ]);

  if (!directGroup) notFound();

  const members: AccessGroupMember[] = directGroup.members.map((m) => ({
    id: m.id,
    accountId: m.accountId,
    displayName: m.displayName,
    subtitle: m.subtitle,
  }));

  const allApps = [...connectedApps.firstParty, ...connectedApps.thirdParty];

  return (
    <AccessGroupView
      name={directGroup.name}
      description="Direct access grants on this account."
      members={members}
      assets={[]}
      accountsHref="/access/account"
      assetsHref="/access/asset"
      assignHref="/access/assign"
      allMembersHref="/access/account"
      allAssetsHref="/access/asset"
    >
      {/* Applications */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Applications</h2>
          {allApps.length > 0 && (
            <FlowLink
              href="/access/application"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Manage
              <ChevronRight className="h-3.5 w-3.5" />
            </FlowLink>
          )}
        </div>
        {allApps.length > 0 ? (
          <div className="overflow-hidden rounded-lg border divide-y">
            {allApps.map((app) => (
              <FlowLink
                key={app.id}
                href="/access/application"
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <AppWindow className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.name}</p>
                    {app.description && (
                      <p className="truncate text-xs text-muted-foreground">{app.description}</p>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </FlowLink>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dotted bg-transparent">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <AppWindow className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-medium">No applications connected</p>
                <p className="text-xs text-muted-foreground">
                  Applications will appear here once connected to your account.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Portfolios */}
      <div className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Portfolios</h2>
        <div className="overflow-hidden rounded-lg border divide-y">
          <CreateAssetGroupCard variant="row" />
          {portfolios.map((portfolio) => (
            <FlowLink
              key={portfolio.id}
              href={`/access?portfolio=${portfolio.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{portfolio.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {portfolio._count.members} members · {portfolio._count.assets} assets
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </FlowLink>
          ))}
        </div>
      </div>
    </AccessGroupView>
  );
}

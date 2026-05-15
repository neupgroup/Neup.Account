import { notFound } from 'next/navigation';
import { FlowLink } from '@/components/ui/flow-link';
import { FolderGit2, ChevronRight } from '@/components/icons';
import { getDirectAccessGroup } from '@/services/manage/access';
import { getAccessAssetGroups, getAccessAssetGroup } from '@/services/manage/access/assets';
import { getActiveAccountId } from '@/core/auth/verify';
import { getUserProfile } from '@/services/user';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { CreateAssetGroupCard } from './create-asset-group-card';
import { SecondaryHeader } from '@/components/ui/secondary-header';
import {
  AccessGroupView,
  type AccessGroupMember,
  type AccessGroupAsset,
} from './_components/access-group-view';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

// ── Portfolio detail view — section 1 only ────────────────────────────────────

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

  // Portfolio view: section 1 only — no portfolios section
  return (
    <AccessGroupView
      name={group.name}
      description={group.description ?? undefined}
      members={memberProfiles}
      assets={assets}
      backHref="/access"
      accountsHref={`/access/account?portfolio=${id}`}
      assetsHref={`/access/asset?portfolio=${id}`}
      applicationsHref={`/access/application`}
      allAssetsHref={`/access/asset?portfolio=${id}`}
    />
  );
}

// ── Individual view — section 1 + section 2 (portfolios) ─────────────────────

export default async function AccessControlPage({ searchParams }: PageProps) {
  const { portfolio: portfolioId } = await searchParams;

  if (portfolioId) {
    return <PortfolioDetail id={portfolioId} />;
  }

  const accountId = await getActiveAccountId();

  const [directGroup, portfolios] = await Promise.all([
    accountId ? getDirectAccessGroup(accountId) : null,
    getAccessAssetGroups(),
  ]);

  if (!directGroup) notFound();

  const members: AccessGroupMember[] = directGroup.members.map((m) => ({
    id: m.id,
    accountId: m.accountId,
    displayName: m.displayName,
    subtitle: m.subtitle,
  }));

  return (
    <AccessGroupView
      name={directGroup.name}
      description="Direct access grants on this account."
      members={members}
      assets={[]}
      accountsHref="/access/account"
      assetsHref="/access/asset"
      applicationsHref="/access/application"
      allAssetsHref="/access/asset"
    >
      {/* Section 2 — Portfolios */}
      <div className="space-y-2">
        <SecondaryHeader
          title="Portfolios"
          description="Manage asset groups and role-based access."
        />
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

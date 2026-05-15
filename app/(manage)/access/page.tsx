import { notFound } from 'next/navigation';
import { FlowLink } from '@/components/ui/flow-link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppWindow, ChevronRight, Database, FolderGit2, Shield, UserCircle, UserPlus, Users } from '@/components/icons';
import { getAccessList } from '@/services/manage/access';
import { getAccessAssetGroups, getAccessAssetGroup } from '@/services/manage/access/assets';
import { getActiveAccountId } from '@/core/auth/verify';
import { getConnectedApplications } from '@/services/applications/connected';
import { getUserProfile } from '@/services/user';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { AddUserForm } from './add-user-form';
import { CreateAssetGroupCard } from './create-asset-group-card';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

// ── Portfolio detail view (inline, replaces /access/portfolio/[id]) ───────────

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
      return { id: member.id, accountId: member.accountId, name };
    })
  );

  const nameMap = Object.fromEntries(memberProfiles.map((p) => [p.accountId, p.name]));
  const assetNameMap = await resolveAssetNames(group.assets);

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{group.name}</h1>
          {group.description && (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{group.members.length}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            <span>{group.assets.length}</span>
          </div>
        </div>
      </div>

      {/* Section links */}
      <div className="overflow-hidden rounded-lg border divide-y">
        {/* Accounts */}
        <FlowLink
          href={`/access/account?portfolio=${id}`}
          className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Accounts</p>
              <p className="text-xs text-muted-foreground">
                {group.members.length > 0
                  ? `${group.members.length} member${group.members.length !== 1 ? 's' : ''}`
                  : 'No members yet'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {group.members.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {group.members.length}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </FlowLink>

        {/* Assets */}
        <FlowLink
          href={`/access/asset?portfolio=${id}`}
          className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Database className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Assets</p>
              <p className="text-xs text-muted-foreground">
                {group.assets.length > 0
                  ? `${group.assets.length} asset${group.assets.length !== 1 ? 's' : ''}`
                  : 'No assets yet'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {group.assets.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {group.assets.length}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </FlowLink>

        {/* Assign Permissions */}
        <FlowLink
          href={`/access/assign?portfolio=${id}`}
          className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Assign Permissions</p>
              <p className="text-xs text-muted-foreground">
                Grant members access to assets with roles
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </FlowLink>
      </div>

      {/* Members preview */}
      {group.members.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {group.members.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t divide-y">
              {group.members.slice(0, 5).map((member) => {
                const displayName = nameMap[member.accountId] ?? member.accountId;
                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {member.accountId}
                      </p>
                    </div>
                  </div>
                );
              })}
              {group.members.length > 5 && (
                <FlowLink
                  href={`/access/account?portfolio=${id}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  View all {group.members.length} members
                  <ChevronRight className="h-3 w-3" />
                </FlowLink>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets preview */}
      {group.assets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-muted-foreground" />
              Assets
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {group.assets.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t divide-y">
              {group.assets.slice(0, 5).map((asset) => {
                const resolved = assetNameMap[asset.id];
                return (
                  <FlowLink
                    key={asset.id}
                    href={`/access/asset?portfolio=${id}&asset=${asset.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {resolved?.name ?? asset.assetId}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {resolved?.subtitle ?? asset.assetType}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {asset.assetType}
                    </Badge>
                  </FlowLink>
                );
              })}
              {group.assets.length > 5 && (
                <FlowLink
                  href={`/access/asset?portfolio=${id}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  View all {group.assets.length} assets
                  <ChevronRight className="h-3 w-3" />
                </FlowLink>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main access page ──────────────────────────────────────────────────────────

export default async function AccessControlPage({ searchParams }: PageProps) {
  const { portfolio: portfolioId } = await searchParams;

  // When ?portfolio=[id] is present, show the portfolio detail inline
  if (portfolioId) {
    return <PortfolioDetail id={portfolioId} />;
  }

  const accountId = await getActiveAccountId();
  const [accessList, portfolios, connectedApps] = await Promise.all([
    accountId ? getAccessList(accountId) : [],
    getAccessAssetGroups(),
    getConnectedApplications(),
  ]);

  const allApps = [...connectedApps.firstParty, ...connectedApps.thirdParty];
  const yourAccess = accessList.filter((item) => item.isSelf);
  const othersAccess = accessList.filter((item) => !item.isSelf);

  return (
    <div className="grid gap-8">
      <PrimaryHeader
        title="Access & Control"
        description="Manage who can access this account and what they can do."
      />

      {/* Grant access */}
      <div className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Grant Access</h2>
        <AddUserForm />
      </div>

      {/* Your access — self-grants */}
      {yourAccess.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Access</h2>
          <div className="overflow-hidden rounded-lg border divide-y">
            {yourAccess.map((item) => (
              <FlowLink
                key={item.permitId}
                href={`/access/${item.permitId}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.permissions.join(', ')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </FlowLink>
            ))}
          </div>
        </div>
      )}

      {/* People with access */}
      <div className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">People with Access</h2>
        {othersAccess.length > 0 ? (
          <div className="overflow-hidden rounded-lg border divide-y">
            {othersAccess.map((item) => (
              <FlowLink
                key={item.permitId}
                href={`/access/${item.permitId}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.permissions.join(', ')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </FlowLink>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dotted bg-transparent hover:bg-muted/20 transition-colors cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted group-hover:bg-muted/70 transition-colors">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-medium">Invite someone to manage your account</p>
                <p className="text-xs text-muted-foreground">Use the field above to grant access by NeupID.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
    </div>
  );
}

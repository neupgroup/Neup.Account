import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Database, UserCircle, Users, UserPlus } from '@/components/icons';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { getUserProfile } from '@/services/user';
import { FlowLink } from '@/components/ui/flow-link';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PortfolioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const group = await getAccessAssetGroup(id);

  if (!group) notFound();

  // Resolve display names for all members in parallel
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

  const nameMap = Object.fromEntries(
    memberProfiles.map((p) => [p.accountId, p.name])
  );

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

      {/* ── Section links ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border divide-y">

        {/* Accounts */}
        <FlowLink
          href={`/access/accounts?portfolio=${id}`}
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
          href={`/access/assets?portfolio=${id}`}
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

      {/* ── Members preview ───────────────────────────────────────────────── */}
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
                  href={`/access/accounts?portfolio=${id}`}
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

      {/* ── Assets preview ────────────────────────────────────────────────── */}
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
                    href={`/access/portfolio/${id}/asset/${asset.id}`}
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
                  href={`/access/assets?portfolio=${id}`}
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

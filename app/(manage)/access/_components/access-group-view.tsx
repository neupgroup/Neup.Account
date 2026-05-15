import { FlowLink } from '@/components/ui/flow-link';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Database, UserCircle, UserPlus, Users } from '@/components/icons';

export type AccessGroupMember = {
  id: string;
  accountId: string;
  displayName: string;
  subtitle?: string;
};

export type AccessGroupAsset = {
  id: string;
  assetId: string;
  name: string;
  subtitle?: string;
  assetType: string;
};

export type AccessGroupViewProps = {
  name: string;
  description?: string;
  members: AccessGroupMember[];
  assets: AccessGroupAsset[];
  accountsHref: string;
  assetsHref: string;
  assignHref: string;
  allMembersHref: string;
  allAssetsHref: string;
  /** href for the back button — omit to hide the back button (e.g. on the root /access page) */
  backHref?: string;
  /** Optional extra sections rendered after the assets preview (e.g. Applications, Portfolios) */
  children?: React.ReactNode;
};

export function AccessGroupView({
  name,
  description,
  members,
  assets,
  accountsHref,
  assetsHref,
  assignHref,
  allMembersHref,
  allAssetsHref,
  backHref,
  children,
}: AccessGroupViewProps) {
  return (
    <div className="grid gap-8">
      {backHref && <BackButton href={backHref} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{name}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{members.length}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            <span>{assets.length}</span>
          </div>
        </div>
      </div>

      {/* Section links */}
      <div className="overflow-hidden rounded-lg border divide-y">
        {/* Accounts */}
        <FlowLink
          href={accountsHref}
          className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Accounts</p>
              <p className="text-xs text-muted-foreground">
                {members.length > 0
                  ? `${members.length} member${members.length !== 1 ? 's' : ''}`
                  : 'No members yet'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {members.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {members.length}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </FlowLink>

        {/* Assets */}
        <FlowLink
          href={assetsHref}
          className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Database className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Assets</p>
              <p className="text-xs text-muted-foreground">
                {assets.length > 0
                  ? `${assets.length} asset${assets.length !== 1 ? 's' : ''}`
                  : 'No assets yet'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {assets.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                {assets.length}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </FlowLink>

        {/* Assign Permissions */}
        <FlowLink
          href={assignHref}
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
      {members.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {members.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t divide-y">
              {members.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member.displayName}</p>
                    {member.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{member.subtitle}</p>
                    )}
                  </div>
                </div>
              ))}
              {members.length > 5 && (
                <FlowLink
                  href={allMembersHref}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  View all {members.length} members
                  <ChevronRight className="h-3 w-3" />
                </FlowLink>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets preview */}
      {assets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-muted-foreground" />
              Assets
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {assets.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t divide-y">
              {assets.slice(0, 5).map((asset) => (
                <FlowLink
                  key={asset.id}
                  href={`${allAssetsHref}&asset=${asset.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    {asset.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{asset.subtitle}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {asset.assetType}
                  </Badge>
                </FlowLink>
              ))}
              {assets.length > 5 && (
                <FlowLink
                  href={allAssetsHref}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  View all {assets.length} assets
                  <ChevronRight className="h-3 w-3" />
                </FlowLink>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {children}
    </div>
  );
}

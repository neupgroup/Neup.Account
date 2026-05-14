import { FlowLink } from '@/components/ui/flow-link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Card, CardContent } from '@/components/ui/card';
import { AppWindow, ChevronRight, FolderGit2, Shield, UserCircle, UserPlus } from '@/components/icons';
import { getAccessList } from '@/services/manage/access';
import { getAccessAssetGroups } from '@/services/manage/access/assets';
import { getActiveAccountId } from '@/core/auth/verify';
import { getConnectedApplications } from '@/services/applications/connected';
import { AddUserForm } from './add-user-form';
import { CreateAssetGroupCard } from './create-asset-group-card';

export default async function AccessControlPage() {
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
              href={`/access/portfolio/${portfolio.id}`}
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

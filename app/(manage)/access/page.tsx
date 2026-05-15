import { notFound } from 'next/navigation';
import { FlowLink } from '@/components/ui/flow-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderGit2, ChevronRight, UserCircle } from '@/components/icons';
import { getDirectAccessGroup, getPortfolioMemberDetail } from '@/services/manage/access';
import { getAccessAssetGroups, getAccessAssetGroup } from '@/services/manage/access/assets';
import { getActiveAccountId } from '@/core/auth/verify';
import { CreateAssetGroupCard } from './create-asset-group-card';
import { SecondaryHeader } from '@/components/ui/secondary-header';
import { AccessGroupView } from './_components/access-group-view';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Badge } from '@/components/ui/badge';

type PageProps = {
  searchParams: Promise<{ portfolio?: string; member?: string }>;
};

// ── Portfolio member detail view ──────────────────────────────────────────────

async function PortfolioMemberDetail({
  portfolioId,
  memberAccountId,
}: {
  portfolioId: string;
  memberAccountId: string;
}) {
  const detail = await getPortfolioMemberDetail(portfolioId, memberAccountId);
  if (!detail) notFound();

  return (
    <div className="grid gap-8">
      <BackButton href={`/access/member?portfolio=${portfolioId}`} />

      <PrimaryHeader
        title={detail.displayName}
        description={`Member of portfolio "${detail.portfolioName}"`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            Roles assigned to this member across assets in this portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          {detail.roles.length > 0 ? (
            <div className="divide-y">
              {detail.roles.map((role, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{role.roleName}</p>
                    {role.roleDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5">{role.roleDescription}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      on <span className="font-medium text-foreground">{role.assetName}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {role.assetType.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <UserCircle className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="font-medium">No roles assigned</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                This member has not been assigned any roles on assets in this portfolio yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Portfolio detail view — section 1 only ────────────────────────────────────

async function PortfolioDetail({ id }: { id: string }) {
  const group = await getAccessAssetGroup(id);
  if (!group) notFound();

  return (
    <AccessGroupView
      pageTitle="Access & Control"
      pageDescription="Manage who can access this account and what they can do."
      name={group.name}
      description={group.description ?? 'Portfolio access group.'}
      backHref="/access"
      membersHref={`/access/member?portfolio=${id}`}
      assetsHref={`/access/asset?portfolio=${id}`}
      applicationsHref="/access/application"
      allAssetsHref={`/access/asset?portfolio=${id}`}
    />
  );
}

// ── Individual view — section 1 + section 2 (portfolios) ─────────────────────

export default async function AccessControlPage({ searchParams }: PageProps) {
  const { portfolio: portfolioId, member: memberAccountId } = await searchParams;

  if (portfolioId && memberAccountId) {
    return <PortfolioMemberDetail portfolioId={portfolioId} memberAccountId={memberAccountId} />;
  }

  if (portfolioId) {
    return <PortfolioDetail id={portfolioId} />;
  }

  const accountId = await getActiveAccountId();

  const [directGroup, portfolios] = await Promise.all([
    accountId ? getDirectAccessGroup(accountId) : null,
    getAccessAssetGroups(),
  ]);

  if (!directGroup) notFound();

  return (
    <AccessGroupView
      pageTitle="Access & Control"
      pageDescription="Manage who can access this account and what they can do."
      name={directGroup.name}
      description="Direct access grants on this account."
      membersHref="/access/member"
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
        <Card>
          <CardContent className="divide-y p-2">
            <CreateAssetGroupCard variant="row" />
            {portfolios.map((portfolio) => (
              <FlowLink
                key={portfolio.id}
                href={`/access?portfolio=${portfolio.id}`}
                className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
              >
                <FolderGit2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <p className="font-medium text-foreground truncate">{portfolio.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {portfolio._count.members} members · {portfolio._count.assets} assets
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </FlowLink>
            ))}
          </CardContent>
        </Card>
      </div>
    </AccessGroupView>
  );
}

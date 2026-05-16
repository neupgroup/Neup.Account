import { notFound } from 'next/navigation';
import { getApplicationDetailsForViewerV2, getAppOwnershipData } from '@/services/applications/manage';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Crown, Users, Briefcase, CheckCircle2 } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationOwnershipPage({ params }: Props) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewerV2(id);

  if (!details) notFound();

  if (!details.canDelete && !details.isRootViewer) {
    return (
      <div className="grid gap-8">
        <div className="space-y-4">
          <BackButton href={`/application/${id}`} />
          <PrimaryHeader title="Access" description="Application ownership and access." />
        </div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only the application owner or an administrator can view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const ownership = await getAppOwnershipData(id);

  if (!ownership) {
    return (
      <div className="grid gap-8">
        <div className="space-y-4">
          <BackButton href={`/application/${id}`} />
          <PrimaryHeader title="Access" description="Application ownership and access." />
        </div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription>Could not load ownership data. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <BackButton href={`/application/${id}`} />
        <PrimaryHeader
          title="Access"
          description={`Ownership and access details for ${details.name}.`}
        />
      </div>

      {/* Portfolios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Portfolios
          </CardTitle>
          <CardDescription>Portfolios this application belongs to.</CardDescription>
        </CardHeader>
        <CardContent>
          {ownership.portfolios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This application is not part of any portfolio.
            </p>
          ) : (
            <div className="space-y-0">
              {ownership.portfolios.map((p, i) => {
                const isFirst = i === 0;
                const isLast = i === ownership.portfolios.length - 1;
                const rounding =
                  isFirst && isLast ? 'rounded-lg'
                  : isFirst ? 'rounded-t-lg'
                  : isLast ? 'rounded-b-lg'
                  : '';
                return (
                  <div
                    key={p.portfolioId}
                    className={`flex items-center gap-3 border border-border bg-card px-4 py-3 ${rounding} ${!isFirst ? '-mt-px' : ''}`}
                  >
                    <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.portfolioName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-muted-foreground" />
            Owner{ownership.owners.length !== 1 ? 's' : ''}
          </CardTitle>
          <CardDescription>Accounts with full ownership of this application.</CardDescription>
        </CardHeader>
        <CardContent>
          {ownership.owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No owner found.</p>
          ) : (
            <div className="space-y-0">
              {ownership.owners.map((owner, i) => {
                const isFirst = i === 0;
                const isLast = i === ownership.owners.length - 1;
                const rounding =
                  isFirst && isLast ? 'rounded-lg'
                  : isFirst ? 'rounded-t-lg'
                  : isLast ? 'rounded-b-lg'
                  : '';
                return (
                  <div
                    key={owner.accountId}
                    className={`flex items-center justify-between gap-4 border border-border bg-card px-4 py-3 ${rounding} ${!isFirst ? '-mt-px' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-snug">{owner.displayName}</p>
                        {owner.isVerified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      {owner.neupId && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          @{owner.neupId}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="capitalize text-xs">
                        {owner.accountType}
                      </Badge>
                      <Badge variant="default" className="text-xs">Owner</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access grants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Access Grants
          </CardTitle>
          <CardDescription>
            Accounts with access to this application and how that access was granted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ownership.accessGrants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts have been granted access to this application.
            </p>
          ) : (
            <div className="space-y-0">
              {ownership.accessGrants.map((grant, i) => {
                const isFirst = i === 0;
                const isLast = i === ownership.accessGrants.length - 1;
                const rounding =
                  isFirst && isLast ? 'rounded-lg'
                  : isFirst ? 'rounded-t-lg'
                  : isLast ? 'rounded-b-lg'
                  : '';
                return (
                  <div
                    key={grant.accountId}
                    className={`flex items-start justify-between gap-4 border border-border bg-card px-4 py-3 ${rounding} ${!isFirst ? '-mt-px' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-snug">{grant.displayName}</p>
                        {grant.isVerified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      {grant.neupId && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          @{grant.neupId}
                        </p>
                      )}
                      {grant.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {grant.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-xs font-mono">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant="outline" className="capitalize text-xs">
                        {grant.accountType}
                      </Badge>
                      <Badge
                        variant={grant.via ? 'secondary' : 'outline'}
                        className="text-xs whitespace-nowrap"
                      >
                        {grant.via ? `via ${grant.via}` : 'Direct'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

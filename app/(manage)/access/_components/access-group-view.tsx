import { FlowLink } from '@/components/ui/flow-link';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent } from '@/components/ui/card';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { SecondaryHeader } from '@/components/ui/secondary-header';
import { AppWindow, ChevronRight, Database, Users } from '@/components/icons';

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
  /** Main page title — "Access & Control" */
  pageTitle: string;
  /** Main page description */
  pageDescription: string;
  /** Sub-heading — individual's name or portfolio name */
  name: string;
  /** Sub-heading description */
  description?: string;
  accountsHref: string;
  assetsHref: string;
  applicationsHref: string;
  allAssetsHref: string;
  /** href for the back button — omit to hide (root /access page) */
  backHref?: string;
  /** Section 2 content — only rendered on the individual view */
  children?: React.ReactNode;
};

export function AccessGroupView({
  pageTitle,
  pageDescription,
  name,
  description,
  accountsHref,
  assetsHref,
  applicationsHref,
  backHref,
  children,
}: AccessGroupViewProps) {
  return (
    <div className="grid gap-8">
      {backHref && <BackButton href={backHref} />}

      {/* Main title */}
      <PrimaryHeader title={pageTitle} description={pageDescription} />

      {/* Section 1 */}
      <div className="space-y-2">
        <SecondaryHeader
          title={name}
          description={description ?? ''}
        />
        <Card>
          <CardContent className="divide-y p-2">
            {/* Accounts */}
            <FlowLink
              href={accountsHref}
              className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
            >
              <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-grow min-w-0">
                <p className="font-medium text-foreground">Accounts</p>
                <p className="text-sm text-muted-foreground">Members with access</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </FlowLink>

            {/* Assets */}
            <FlowLink
              href={assetsHref}
              className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
            >
              <Database className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-grow min-w-0">
                <p className="font-medium text-foreground">Assets</p>
                <p className="text-sm text-muted-foreground">Assets in this group</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </FlowLink>

            {/* Applications */}
            <FlowLink
              href={applicationsHref}
              className="flex items-center gap-4 py-4 px-4 hover:bg-muted/50 transition-colors"
            >
              <AppWindow className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-grow min-w-0">
                <p className="font-medium text-foreground">Applications</p>
                <p className="text-sm text-muted-foreground">
                  Connected apps and access grants
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </FlowLink>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 — only on individual view (portfolios etc.) */}
      {children}
    </div>
  );
}

import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppWindow, Database, X } from '@/components/icons';
import {
  addAssetToGroupFromForm,
  removeAssetFromGroupFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { AddAssetForm } from '../portfolio/[id]/add-asset-form';
import { FlowLink } from '@/components/ui/flow-link';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

export default async function PortfolioAssetsPage({ searchParams }: PageProps) {
  const { portfolio: id } = await searchParams;

  if (!id) notFound();

  const group = await getAccessAssetGroup(id);
  if (!group) notFound();

  const assetNameMap = await resolveAssetNames(group.assets);
  const existingAssetIds = group.assets.map((a) => a.assetId);

  const addAssetAction = addAssetToGroupFromForm.bind(null, id);
  const removeAssetAction = removeAssetFromGroupFromForm.bind(null, id);

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${id}`} />

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

      {/* Application shortcut — only shown when there are application-type assets */}
      {group.assets.some((a) => ['application', 'app'].includes(a.assetType.toLowerCase())) && (
        <FlowLink
          href={`/access/application?portfolio=${id}`}
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
                    {/* Icon */}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </span>

                    {/* Info — links to the asset detail page */}
                    <FlowLink
                      href={`/access/portfolio/${id}/asset/${asset.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="text-sm font-medium truncate">
                        {resolved?.name ?? asset.assetId}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {resolved?.subtitle ?? asset.assetType}
                      </p>
                    </FlowLink>

                    {/* Type badge */}
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {asset.assetType}
                    </Badge>

                    {/* Remove */}
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

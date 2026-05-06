import { FlowLink } from '@/components/ui/flow-link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackButton } from '@/components/ui/back-button';
import { ChevronRight } from '@/components/icons';
import { getAccessAssetGroups } from '@/services/manage/access/assets';
import { CreateAssetGroupCard } from '../create-asset-group-card';

export default async function PortfolioListPage() {
  const groups = await getAccessAssetGroups();

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      <PrimaryHeader
        title="Portfolios"
        description="Group assets and members together for structured access and role management."
      />

      <CreateAssetGroupCard />

      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <FlowLink key={group.id} href={`/access/portfolio/${group.id}`} className="group block">
              <Card className="h-full transition-colors group-hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span className="truncate">{group.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {group.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {group._count.members} members · {group._count.assets} assets
                  </p>
                </CardContent>
              </Card>
            </FlowLink>
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dotted bg-transparent">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No portfolios yet. Create one above.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

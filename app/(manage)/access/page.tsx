import Link from 'next/link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from '@/components/icons';
import { getAccessAssetGroups } from '@/services/manage/access/assets';
import { CreateAssetGroupCard } from './create-asset-group-card';

export default async function AccessControlPage() {
  const groups = await getAccessAssetGroups();

  return (
    <div className="grid gap-8">
      <PrimaryHeader
        title="Access & Control"
        description="Manage Assets Group and permission mapping for account and app members."
      />

      <CreateAssetGroupCard />

      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/access/${group.id}`} className="group block">
              <Card className="h-full transition-colors group-hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span className="truncate">{group.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {group.details || 'No details provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {group._count.members} members | {group._count.assets} assets
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dotted bg-transparent">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">no assets group</CardContent>
        </Card>
      )}
    </div>
  );
}

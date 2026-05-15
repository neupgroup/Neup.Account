import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAccessDetails } from '@/services/manage/access';
import { RevokeAccessForm } from './form';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccessDetailPage({ params }: PageProps) {
  const { id } = await params;

  const details = await getAccessDetails(id);

  if (!details) notFound();

  return (
    <div className="grid gap-6">
      <BackButton href="/access" />

      {/* Who this grant is for */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{details.grantedTo.name}</h1>
        <p className="text-muted-foreground">
          {details.grantedTo.neupId !== 'N/A' ? `@${details.grantedTo.neupId}` : details.grantedTo.id}
        </p>
      </div>

      {/* Context: portfolio + account */}
      <Card>
        <CardHeader>
          <CardTitle>Access Context</CardTitle>
          <CardDescription>Where this access applies.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-muted-foreground">Account</span>
            <span className="font-medium">{details.account.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Portfolio</span>
            {details.portfolio ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-medium">{details.portfolio.name}</span>
                {details.portfolio.description && (
                  <span className="text-xs text-muted-foreground">{details.portfolio.description}</span>
                )}
              </div>
            ) : (
              <Badge variant="outline" className="text-xs">Direct grant</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role details */}
      <Card>
        <CardHeader>
          <CardTitle>Role</CardTitle>
          <CardDescription>What this user can do with this access.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Title</span>
            <span className="font-medium text-right">{details.role.name}</span>
          </div>
          {details.role.description && (
            <div className="flex items-start justify-between gap-4 border-t pt-3">
              <span className="text-muted-foreground shrink-0">Description</span>
              <span className="text-right text-muted-foreground">{details.role.description}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <RevokeAccessForm permitId={details.permitId} />
    </div>
  );
}

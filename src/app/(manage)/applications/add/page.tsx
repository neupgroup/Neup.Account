import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApplicationAccessForm } from '@/app/(manage)/applications/_components/application-access-form';

export default function AddApplicationPage() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Application</h1>
          <p className="text-muted-foreground">Connect an application to your NeupAccount access list.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/applications">Back to Applications</Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Application Access</CardTitle>
          <CardDescription>Add by app id and optional permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationAccessForm mode="add" />
        </CardContent>
      </Card>
    </div>
  );
}

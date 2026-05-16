import { notFound } from 'next/navigation';
import { FlowLink } from '@/components/ui/flow-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getApplicationDetailsForViewer,
  getSilentSsoOrigins,
  addSilentSsoOrigin,
  removeSilentSsoOrigin,
} from '@/services/applications/manage';

type Props = { params: Promise<{ id: string }> };

export default async function SilentSsoOriginsPage({ params }: Props) {
  const { id } = await params;

  const details = await getApplicationDetailsForViewer(id);
  if (!details) notFound();

  const origins = await getSilentSsoOrigins(id);

  async function handleAdd(formData: FormData) {
    'use server';
    const origin = formData.get('origin') as string;
    await addSilentSsoOrigin({ appId: id, origin });
  }

  async function handleRemove(bridgeId: string) {
    'use server';
    await removeSilentSsoOrigin({ appId: id, bridgeId });
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Silent SSO Origins</h1>
          <p className="text-muted-foreground">
            Manage the trusted origins allowed to silently authenticate users via the NeupID iframe bridge.
          </p>
        </div>
        <Button variant="outline" asChild>
          <FlowLink href={`/application/${id}`}>Back</FlowLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What are Silent SSO Origins?</CardTitle>
          <CardDescription>
            Silent SSO allows your application to authenticate users without a visible redirect by embedding a hidden
            iframe pointing to the NeupID auth server. Only origins registered here are permitted to receive
            authentication tokens via <code>postMessage</code>. Each origin must use HTTPS and is matched by
            scheme and host only (path and query string are ignored).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered Origins</CardTitle>
          <CardDescription>
            These origins are currently allowed to perform silent authentication for this application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {origins.length > 0 ? (
            <ul className="space-y-2">
              {origins.map((entry) => {
                const removeAction = handleRemove.bind(null, entry.id);
                return (
                  <li key={entry.id} className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
                    <code className="text-sm break-all">{entry.value}</code>
                    <form action={removeAction}>
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No origins registered yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Origin</CardTitle>
          <CardDescription>
            Enter a valid HTTPS URL. Only the scheme and host are stored — for example,{' '}
            <code>https://example.com</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px] space-y-2">
              <label htmlFor="origin" className="text-sm font-medium">
                Origin URL
              </label>
              <Input
                id="origin"
                name="origin"
                type="url"
                placeholder="https://example.com"
                required
              />
            </div>
            <Button type="submit">Add Origin</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

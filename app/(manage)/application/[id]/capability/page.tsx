import { notFound } from 'next/navigation';
import { getApplicationDetailsForViewerV2 } from '@/services/applications/manage';
import { getAppCapabilities } from '@/services/applications/authz-manage';
import { BackButton } from '@/components/ui/back-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { CapabilityPanel } from '@/app/(manage)/application/_components/capability-panel';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationCapabilityPage({ params }: Props) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewerV2(id);

  if (!details) notFound();

  if (!details.canDelete) {
    return (
      <div className="grid gap-6">
        <div>
          <BackButton href={`/application/${id}`} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Capabilities</h1>
        </div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>Only the application owner can manage capabilities.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const capabilities = await getAppCapabilities(id);

  return (
    <div className="grid gap-6">
      <div>
        <BackButton href={`/application/${id}`} />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Capabilities</h1>
      </div>
      <CapabilityPanel appId={id} initialCapabilities={capabilities} />
    </div>
  );
}

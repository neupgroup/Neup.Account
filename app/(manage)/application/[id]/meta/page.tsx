import { notFound } from 'next/navigation';
import { getApplicationDetailsForViewerV2 } from '@/services/applications/manage';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { AppMetaForm } from '@/app/(manage)/application/_components/app-meta-form';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationMetaPage({ params }: Props) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewerV2(id);

  if (!details) notFound();

  if (!details.canDelete) {
    return (
      <div className="grid gap-8">
        <div className="space-y-4">
          <BackButton href={`/applications/${id}`} />
          <PrimaryHeader title="General Info" description="Application metadata." />
        </div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>Only the application owner can edit metadata.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <BackButton href={`/applications/${id}`} />
        <PrimaryHeader
          title="General Info"
          description={`Edit the public-facing details for ${details.name}.`}
        />
      </div>

      <AppMetaForm
        appId={id}
        initialName={details.name}
        initialDescription={details.description}
        initialIcon={details.icon}
        initialWebsite={details.website}
      />
    </div>
  );
}

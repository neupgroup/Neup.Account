import { notFound } from 'next/navigation';
import { getApplicationDetailsForViewerV2 } from '@/services/applications/manage';
import { getAppCapabilities, getAppRoles } from '@/services/applications/authz-manage';
import { getAuthzWebhookUrl } from '@/services/applications/authz-webhook';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { RolesPanel } from '@/app/(manage)/applications/_components/roles-panel';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationRolesPage({ params }: Props) {
  const { id } = await params;
  const details = await getApplicationDetailsForViewerV2(id);

  if (!details) notFound();

  if (!details.canDelete) {
    return (
      <div className="grid gap-8">
        <div className="space-y-4">
          <BackButton href={`/applications/${id}`} />
          <PrimaryHeader
            title="Roles"
            description={`Manage roles for ${details.name}.`}
          />
        </div>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>Only the application owner can manage roles.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const [capabilities, roles, webhookUrl] = await Promise.all([
    getAppCapabilities(id),
    getAppRoles(id),
    getAuthzWebhookUrl(id),
  ]);

  return (
    <div className="grid gap-8">
      <div className="space-y-4">
        <BackButton href={`/applications/${id}`} />
        <PrimaryHeader
          title="Roles"
          description={`Group capabilities into roles for ${details.name}.`}
        />
      </div>
      <RolesPanel
        appId={id}
        initialRoles={roles}
        capabilities={capabilities}
        hasWebhook={Boolean(webhookUrl)}
      />
    </div>
  );
}

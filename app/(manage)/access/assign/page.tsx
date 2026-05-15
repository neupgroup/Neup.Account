import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, UserPlus } from '@/components/icons';
import {
  assignRoleToAssetMemberFromForm,
  bulkAssignPermissionsFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { getUserProfile } from '@/services/user';
import { AssignPermissionsWizard } from '../_components/assign-permissions-wizard';
import { RoleAssignForm } from '../_components/role-assign-form';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

export default async function PortfolioAssignPage({ searchParams }: PageProps) {
  const { portfolio: id } = await searchParams;

  if (!id) notFound();

  const group = await getAccessAssetGroup(id);
  if (!group) notFound();

  // Resolve member display names
  const memberProfiles = await Promise.all(
    group.members.map(async (member) => {
      const profile = await getUserProfile(member.accountId);
      const name =
        profile?.nameDisplay ||
        (profile?.nameFirst || profile?.nameLast
          ? `${profile.nameFirst ?? ''} ${profile.nameLast ?? ''}`.trim()
          : null) ||
        member.accountId;
      return { id: member.id, accountId: member.accountId, name };
    })
  );

  const nameMap = Object.fromEntries(
    memberProfiles.map((p) => [p.accountId, p.name])
  );

  const assetNameMap = await resolveAssetNames(group.assets);
  const existingAssetIds = group.assets.map((a) => a.assetId);

  const bulkAssignAction = bulkAssignPermissionsFromForm.bind(null, id);
  const assignRoleAction = assignRoleToAssetMemberFromForm.bind(null, id);

  const members = group.members.map((m) => ({
    id: m.id,
    accountId: m.accountId,
    displayName: nameMap[m.accountId] ?? m.accountId,
  }));

  const assets = group.assets.map((a) => ({
    id: a.id,
    label: assetNameMap[a.id]?.name ?? a.assetId,
  }));

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${id}`} />

      {/* Header */}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {group.name}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Assign Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant members access to assets with specific roles.
        </p>
      </div>

      {/* Wizard — bulk assign across multiple assets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Bulk Assign
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Walk through member → asset type → assets → roles to assign permissions in one go.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <AssignPermissionsWizard
              action={bulkAssignAction}
              groupId={id}
              members={members}
              existingAssetIds={existingAssetIds}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick role assign — single member + asset + role */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Quick Assign
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Assign a single role to a member for a specific asset.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            {members.length > 0 && assets.length > 0 ? (
              <RoleAssignForm
                action={assignRoleAction}
                members={members}
                assets={assets}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <KeyRound className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="text-sm text-muted-foreground">
                  {members.length === 0
                    ? 'Add accounts to the portfolio first.'
                    : 'Add assets to the portfolio first.'}
                </p>
                <div className="flex gap-2 mt-1">
                  {members.length === 0 && (
                    <a
                      href={`/access/account?portfolio=${id}`}
                      className="text-xs text-foreground underline underline-offset-2"
                    >
                      Add accounts
                    </a>
                  )}
                  {assets.length === 0 && (
                    <a
                      href={`/access/asset?portfolio=${id}`}
                      className="text-xs text-foreground underline underline-offset-2"
                    >
                      Add assets
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current role assignments summary */}
      {group.members.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Current Assignments
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {members.length} members
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t divide-y">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {member.accountId}
                    </p>
                  </div>
                  <a
                    href={`/access/assign?portfolio=${id}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    manage
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

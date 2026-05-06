import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Database, KeyRound, Shield, UserCircle, Users, X, UserPlus } from '@/components/icons';
import {
  addAssetToGroupFromForm,
  addMemberToAssetGroupFromForm,
  assignRoleToAssetMemberFromForm,
  removeAssetFromGroupFromForm,
  bulkAssignPermissionsFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { getUserProfile } from '@/services/user';
import { AddMemberForm } from './add-member-form';
import { AddAssetForm } from './add-asset-form';
import { RoleAssignForm } from './role-assign-form';
import { AssignPermissionsWizard } from './assign-permissions-wizard';
import { FlowLink } from '@/components/ui/flow-link';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PortfolioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const group = await getAccessAssetGroup(id);

  if (!group) notFound();

  // Resolve display names for all members in parallel
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

  // Resolve display names for all assets in parallel
  const assetNameMap = await resolveAssetNames(group.assets);

  const getMemberDetails = (value: unknown) => {
    const d = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      isPermanent: d.isPermanent === true,
      removesOn: typeof d.removesOn === 'string' ? d.removesOn : null,
      hasFullAccess: d.hasFullAccess === true,
    };
  };

  const addMemberAction = addMemberToAssetGroupFromForm.bind(null, id);
  const addAssetAction = addAssetToGroupFromForm.bind(null, id);
  const removeAssetAction = removeAssetFromGroupFromForm.bind(null, id);
  const assignRoleAction = assignRoleToAssetMemberFromForm.bind(null, id);
  const bulkAssignAction = bulkAssignPermissionsFromForm.bind(null, id);

  const roleRows = (Array.isArray((group as { roles?: unknown }).roles)
    ? (group as { roles?: unknown[] }).roles
    : []) as Array<{ id: string; accountId: string; roleId: string }>;

  // IDs already in this portfolio — passed to the add form to filter duplicates
  const existingAssetIds = group.assets.map((a) => a.assetId);

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="mt-1 text-muted-foreground">{group.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-muted-foreground pt-1">
          <span>{group.members.length} accounts</span>
          <span>·</span>
          <span>{group.assets.length} assets</span>
        </div>
      </div>

      {/* ── Accounts ─────────────────────────────────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Accounts</h2>
        </div>

        <div className="overflow-hidden rounded-lg border divide-y">
          <AddMemberForm action={addMemberAction} />

          {group.members.length > 0 ? (
            group.members.map((member) => {
              const d = getMemberDetails(member.details);
              const memberRoles = roleRows.filter((r) => r.accountId === member.accountId);
              const displayName = nameMap[member.accountId] ?? member.accountId;
              return (
                <div key={member.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {d.isPermanent ? (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">permanent</Badge>
                      ) : d.removesOn ? (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          expires {new Date(d.removesOn).toLocaleDateString()}
                        </Badge>
                      ) : null}
                      {d.hasFullAccess && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">full access</Badge>
                      )}
                      {memberRoles.map((r) => (
                        <Badge key={r.id} variant="outline" className="font-mono text-xs px-1.5 py-0">
                          {r.roleId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 shrink-0" />
              No accounts added yet.
            </div>
          )}
        </div>
      </section>

      {/* ── Assets ───────────────────────────────────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Assets</h2>
        </div>

        <div className="overflow-hidden rounded-lg border divide-y">
          <AddAssetForm action={addAssetAction} existingAssetIds={existingAssetIds} />

          {group.assets.length > 0 ? (
            group.assets.map((asset) => {
              const resolved = assetNameMap[asset.id];
              return (
                <div key={asset.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <FlowLink
                    href={`/access/portfolio/${id}/asset/${asset.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{resolved?.name ?? asset.assetId}</p>
                      <p className="text-xs text-muted-foreground">
                        {resolved?.subtitle ?? asset.assetType}
                      </p>
                    </div>
                  </FlowLink>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="text-xs">{asset.assetType}</Badge>
                    {/* Remove asset — moves it back to the caller's personal portfolio */}
                    <form action={removeAssetAction}>
                      <input type="hidden" name="portfolioAssetId" value={asset.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${resolved?.name ?? asset.assetId} from portfolio`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
              <Database className="h-4 w-4 shrink-0" />
              No assets added yet.
            </div>
          )}
        </div>
      </section>

      {/* ── Assign Permissions (Wizard) ──────────────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Assign Permissions</h2>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <AssignPermissionsWizard
            action={bulkAssignAction}
            members={group.members.map((m) => ({
              id: m.id,
              accountId: m.accountId,
              displayName: nameMap[m.accountId] ?? m.accountId,
            }))}
            existingAssetIds={existingAssetIds}
          />
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Roles</h2>
        </div>

        <div className="overflow-hidden rounded-lg border divide-y">
          <RoleAssignForm
            action={assignRoleAction}
            members={group.members.map((m) => ({
              id: m.id,
              accountId: m.accountId,
              displayName: nameMap[m.accountId] ?? m.accountId,
            }))}
            assets={group.assets.map((a) => ({
              id: a.id,
              label: assetNameMap[a.id]?.name ?? a.assetId,
            }))}
          />

          {group.members.length > 0 && roleRows.length > 0 ? (
            group.members
              .filter((member) => roleRows.some((r) => r.accountId === member.accountId))
              .map((member) => {
                const memberRoles = roleRows.filter((r) => r.accountId === member.accountId);
                const displayName = nameMap[member.accountId] ?? member.accountId;
                return (
                  <div key={member.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {memberRoles.map((r) => (
                          <Badge key={r.id} variant="secondary" className="font-mono text-xs px-1.5 py-0">
                            {r.roleId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4 shrink-0" />
              {group.members.length === 0
                ? 'Add accounts first to assign roles.'
                : 'No roles assigned yet.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

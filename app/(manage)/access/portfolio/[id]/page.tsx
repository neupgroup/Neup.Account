import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Database, Key, KeyRound, Plus, Shield, UserCircle, Users } from '@/components/icons';
import {
  addAssetToGroupFromForm,
  addMemberToAssetGroupFromForm,
  assignRoleToAssetMemberFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { resolveAssetNames } from '@/services/manage/access/asset-resolvers';
import { getUserProfile } from '@/services/user';
import { AddMemberForm } from './add-member-form';

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
  const assignRoleAction = assignRoleToAssetMemberFromForm.bind(null, id);

  const roleRows = (Array.isArray((group as { roles?: unknown }).roles)
    ? (group as { roles?: unknown[] }).roles
    : []) as Array<{ id: string; accountId: string; roleId: string }>;

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
          <form action={addAssetAction} className="px-4 py-3 grid gap-3 sm:grid-cols-3">
            <Input name="asset" placeholder="Asset ID" required className="h-8 text-sm" />
            <Input name="type" placeholder="Type (e.g. app, account)" required className="h-8 text-sm" />
            <Input name="details" placeholder="Note (optional)" className="h-8 text-sm" />
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Asset
              </Button>
            </div>
          </form>

          {group.assets.length > 0 ? (
            group.assets.map((asset) => {
              const resolved = assetNameMap[asset.id];
              return (
                <div key={asset.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{resolved?.name ?? asset.assetId}</p>
                      <p className="text-xs text-muted-foreground">
                        {resolved?.subtitle ?? asset.assetType}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">{asset.assetType}</Badge>
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

      {/* ── Roles ────────────────────────────────────────────────────────── */}
      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Roles</h2>
        </div>

        <div className="overflow-hidden rounded-lg border divide-y">
          <form action={assignRoleAction} className="px-4 py-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="assetMember" className="sr-only">Account</Label>
              <select
                id="assetMember"
                name="assetMember"
                aria-label="Select account"
                className="h-8 w-full rounded-md border bg-background px-3 text-sm"
                required
              >
                <option value="">Account</option>
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {nameMap[member.accountId] ?? member.accountId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="asset" className="sr-only">Asset</Label>
              <select
                id="asset"
                name="asset"
                aria-label="Select asset"
                className="h-8 w-full rounded-md border bg-background px-3 text-sm"
                required
              >
                <option value="">Asset</option>
                {group.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {assetNameMap[asset.id]?.name ?? asset.assetId}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Input
                id="role"
                name="role"
                placeholder="Role (e.g. manager.read)"
                required
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" className="shrink-0 gap-1.5">
                <Key className="h-3.5 w-3.5" />
                Set
              </Button>
            </div>
          </form>

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

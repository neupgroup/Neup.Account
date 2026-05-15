import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, UserCircle, X } from '@/components/icons';
import {
  addMemberToAssetGroupFromForm,
  removeMemberFromAssetGroupFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { getDirectAccessGroup } from '@/services/manage/access';
import { getActiveAccountId } from '@/core/auth/verify';
import { getUserProfile } from '@/services/user';
import { AddMemberForm } from '../_components/add-member-form';
import { AddUserForm } from '../add-user-form';
import { FlowLink } from '@/components/ui/flow-link';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

// ── Portfolio members view ────────────────────────────────────────────────────

async function PortfolioAccountPage({ id }: { id: string }) {
  const group = await getAccessAssetGroup(id);
  if (!group) notFound();

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

  const getMemberDetails = (value: unknown) => {
    const d = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      isPermanent: d.isPermanent === true,
      removesOn: typeof d.removesOn === 'string' ? d.removesOn : null,
      hasFullAccess: d.hasFullAccess === true,
    };
  };

  const addMemberAction = addMemberToAssetGroupFromForm.bind(null, id);
  const removeMemberAction = removeMemberFromAssetGroupFromForm.bind(null, id);

  return (
    <div className="grid gap-8">
      <BackButton href={`/access?portfolio=${id}`} />

      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Members with Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Members with access to Portfolio &ldquo;{group.name}&rdquo;
        </p>
      </div>

      {/* Invite + members in a tighter group */}
      <div className="grid gap-3">
        <AddMemberForm action={addMemberAction} />

        {/* Members card */}
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
            {group.members.length > 0 ? (
              group.members.map((member) => {
                const d = getMemberDetails(member.details);
                const displayName = nameMap[member.accountId] ?? member.accountId;

                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {member.accountId}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
                    </div>
                    <form action={removeMemberAction}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${displayName} from portfolio`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No members yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Add a member above using their NeupID.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// ── Direct access members view (no portfolio) ─────────────────────────────────

async function DirectAccountPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) notFound();

  const group = await getDirectAccessGroup(accountId);
  if (!group) notFound();

  return (
    <div className="grid gap-8">
      <BackButton href="/access" />

      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">Members with Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Members with access to Profile &ldquo;{group.name}&rdquo;
        </p>
      </div>

      {/* Invite + members in a tighter group */}
      <div className="grid gap-3">
        <AddUserForm />

        {/* Members card */}
        <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {group.members.length > 0 ? (
              group.members.map((member) => (
                <FlowLink
                  key={member.id}
                  href={`/access/${member.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.subtitle}</p>
                  </div>
                </FlowLink>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-6 w-6 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No members yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Use the form above to invite someone by NeupID.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default async function MemberPage({ searchParams }: PageProps) {
  const { portfolio: id } = await searchParams;

  if (id) {
    return <PortfolioAccountPage id={id} />;
  }

  return <DirectAccountPage />;
}

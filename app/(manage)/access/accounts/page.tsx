import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, UserCircle, Users, X } from '@/components/icons';
import {
  addMemberToAssetGroupFromForm,
  removeMemberFromAssetGroupFromForm,
} from '@/services/manage/access/actions';
import { getAccessAssetGroup } from '@/services/manage/access/assets';
import { getUserProfile } from '@/services/user';
import { AddMemberForm } from '../portfolio/[id]/add-member-form';

type PageProps = {
  searchParams: Promise<{ portfolio?: string }>;
};

export default async function PortfolioAccountsPage({ searchParams }: PageProps) {
  const { portfolio: id } = await searchParams;

  if (!id) notFound();

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

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {group.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage who has access to this portfolio.
          </p>
        </div>
        {group.members.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{group.members.length}</span>
          </div>
        )}
      </div>

      {/* Add member */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Add Account</CardTitle>
          <p className="text-xs text-muted-foreground">
            Look up a NeupID to add someone to this portfolio.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <AddMemberForm action={addMemberAction} />
          </div>
        </CardContent>
      </Card>

      {/* Member list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            Members
            {group.members.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {group.members.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t divide-y">
            {group.members.length > 0 ? (
              group.members.map((member) => {
                const d = getMemberDetails(member.details);
                const displayName = nameMap[member.accountId] ?? member.accountId;

                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                    </span>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {member.accountId}
                      </p>
                    </div>

                    {/* Badges */}
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {d.isPermanent ? (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          permanent
                        </Badge>
                      ) : d.removesOn ? (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          expires {new Date(d.removesOn).toLocaleDateString()}
                        </Badge>
                      ) : null}
                      {d.hasFullAccess && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          full access
                        </Badge>
                      )}
                    </div>

                    {/* Remove */}
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
                <p className="text-sm font-medium">No accounts yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Add a member above using their NeupID. They'll get access to the assets in this portfolio.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  addAssetToGroupFromForm,
  addMemberToAssetGroupFromForm,
  assignRoleToAssetMemberFromForm,
} from '@/services/manage/access/actions';
import {
  getAccessAssetGroup,
} from '@/services/manage/access/assets';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AssetGroupPage({ params }: PageProps) {
  const { id } = await params;
  const group = await getAccessAssetGroup(id);

  if (!group) {
    notFound();
  }

  const getMemberDetails = (value: unknown) => {
    const details = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      isPermanent: details.isPermanent === true,
      removesOn: typeof details.removesOn === 'string' ? details.removesOn : null,
      hasFullAccess: details.hasFullAccess === true,
    };
  };

  const addMemberAction = addMemberToAssetGroupFromForm.bind(null, id);
  const addAssetAction = addAssetToGroupFromForm.bind(null, id);
  const assignRoleAction = assignRoleToAssetMemberFromForm.bind(null, id);

  return (
    <div className="grid gap-6">
      <BackButton href="/access" />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-muted-foreground">{group.description || 'Manage members, assets, and roles for this group.'}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group Members</CardTitle>
          <CardDescription>
            Use plain account ID or account:id.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addMemberAction} className="grid gap-3 md:grid-cols-2">
            <Input name="member" placeholder="63b6151e-... or account:63b6151e-..." required />
            <Input name="validTill" type="datetime-local" />
            <div className="flex items-center gap-2">
              <Checkbox id="isPermanent" name="isPermanent" />
              <Label htmlFor="isPermanent">isPermanent</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="hasFullPermit" name="hasFullPermit" />
              <Label htmlFor="hasFullPermit">hasFullPermit</Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Add Member</Button>
            </div>
          </form>

          {group.members.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              {group.members.map((member) => (
                <div key={member.id} className="border-b px-4 py-3 text-sm last:border-b-0">
                  <p className="font-medium">{member.accountId}</p>
                  {(() => {
                    const d = getMemberDetails(member.details);
                    return (
                      <p className="text-muted-foreground">
                        permanent: {d.isPermanent ? 'yes' : 'no'} | removesOn: {d.removesOn || 'not set'} | fullAccess: {d.hasFullAccess ? 'yes' : 'no'}
                      </p>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No members in this group yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Add assets that belong to this group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addAssetAction} className="grid gap-3 md:grid-cols-2">
            <Input name="asset" placeholder="Asset identifier" required />
            <Input name="type" placeholder="Type" required />
            <Input className="md:col-span-2" name="details" placeholder="Details (optional)" />
            <div className="md:col-span-2">
              <Button type="submit">Add Asset</Button>
            </div>
          </form>

          {group.assets.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              {group.assets.map((asset) => (
                <div key={asset.id} className="border-b px-4 py-3 text-sm last:border-b-0">
                  <p className="font-medium">{asset.assetId}</p>
                  <p className="text-muted-foreground">type: {asset.assetType}</p>
                  <p className="text-muted-foreground">assetId: {asset.assetId}</p>
                  <p className="text-muted-foreground">{asset.details ? JSON.stringify(asset.details) : 'No details.'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No assets in this group yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permission Management</CardTitle>
          <CardDescription>Assign role per member and asset.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={assignRoleAction} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="assetMember">assetMember</Label>
              <select id="assetMember" name="assetMember" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" required>
                <option value="">Select member</option>
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.accountId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="asset">asset</Label>
              <select id="asset" name="asset" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" required>
                <option value="">Select asset</option>
                {group.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="role">role</Label>
              <Input id="role" name="role" placeholder="manager.read" required />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Set Role</Button>
            </div>
          </form>

          {group.members.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              {group.members.map((member) => (
                <div key={member.id} className="border-b px-4 py-3 text-sm last:border-b-0">
                  <p className="font-medium mb-1">{member.accountId}</p>
                  {group.roles.filter((roleRow) => roleRow.accountId === member.accountId).length > 0 ? (
                    <ul className="space-y-1 text-muted-foreground">
                      {group.roles.filter((roleRow) => roleRow.accountId === member.accountId).map((roleRow) => (
                        <li key={roleRow.id}>
                          {roleRow.roleId}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No roles assigned yet.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add members first to assign roles.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


import { getAccessList } from "./actions";
import { getActiveAccountId } from "@/lib/auth-actions";
import { getUserNeupIds } from "@/lib/user";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AddUserForm } from "./add-user-form";
import type { Permission } from "@/types";
import { getMasterPermissions } from "@/actions/root/permission";
import { SecondaryHeader } from "@/components/ui/secondary-header";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function AccessControlPage() {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    notFound();
  }

  // Fetch all permissions by providing a large page size and no search query.
  const [accessList, neupIds, permissionsResponse] = await Promise.all([
    getAccessList(accountId),
    getUserNeupIds(accountId),
    getMasterPermissions("", 1, 999), 
  ]);

  const allPermissions = permissionsResponse.permissions;
  const permissionMap = new Map<string, Permission>(allPermissions.map(p => [p.id, p]));

  const currentNeupId = neupIds[0] || "this account";

  return (
    <div className="grid gap-8">
      <PrimaryHeader
        title="Access & Control"
        description="Review and manage who has access to your account."
      />

       <div className="space-y-2">
          <SecondaryHeader
            title={`People with access to @${currentNeupId}`}
            description="These people have been granted permissions to manage this account. Invitations are now managed on the Notifications page."
          />
        </div>

      {accessList.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {accessList.map((user) => (
                    <Link
                      key={user.permitId}
                      href={`/manage/access/${user.permitId}`}
                      className="flex items-center justify-between py-4 group hover:bg-muted/50 px-6"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={user.displayPhoto} data-ai-hint="person" />
                          <AvatarFallback>
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.displayName}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                              {user.permissions.slice(0, 3).map((pId) => (
                                  <Badge key={pId} variant="outline" className="text-xs">
                                    {permissionMap.get(pId)?.name || 'Unknown'}
                                  </Badge>
                              ))}
                              {user.permissions.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                      +{user.permissions.length - 3} more
                                  </Badge>
                              )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                    </Link>
                  ))}
              </div>
            </CardContent>
             <CardFooter className="p-4 border-t">
                <AddUserForm />
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-4">
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    <p>No other users have been granted access to this account.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <h3 className="font-semibold">Grant Access</h3>
                    <p className="text-sm text-muted-foreground">Enter a user's NeupID to send an invitation to manage this account.</p>
                </CardHeader>
                <CardContent>
                    <AddUserForm />
                </CardContent>
            </Card>
        </div>
        )}
    </div>
  );
}

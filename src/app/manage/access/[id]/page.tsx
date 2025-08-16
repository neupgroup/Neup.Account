
import { getAccessDetails } from "../actions";
import { notFound } from "next/navigation";
import { getMasterPermissions } from "../../root/permission/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AccessManagementForm } from "./form";
import { BackButton } from "@/components/ui/back-button";

export default async function AccessDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const [details, permissionsResponse] = await Promise.all([
    getAccessDetails(params.id),
    getMasterPermissions("", 1, 999),
  ]);

  if (!details) {
    notFound();
  }

  const masterPermissions = permissionsResponse.permissions;
  const permissionMap = new Map(masterPermissions.map(p => [p.id, p]));
  const currentPermissionNames = details.permissions.map(pId => permissionMap.get(pId)?.name).filter(Boolean) as string[];

  return (
    <div className="grid gap-6">
       <BackButton href="/manage/access" />
      <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={details.grantedTo.name} data-ai-hint="person" />
            <AvatarFallback>
              {details.grantedTo.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {details.grantedTo.name}
            </h1>
            <p className="text-muted-foreground font-mono">
              @{details.grantedTo.neupId}
            </p>
          </div>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Access Details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
            <div>
                <p className="text-muted-foreground">Granted On</p>
                <p>{details.grantedOn}</p>
            </div>
             <div>
                <p className="text-muted-foreground">Granted To Manage</p>
                <p>{details.grantedBy.name}</p>
            </div>
             <div>
                <p className="text-muted-foreground">Current Permissions</p>
                <div className="flex flex-wrap gap-2 mt-1">
                    {currentPermissionNames.length > 0 ? currentPermissionNames.map(p => (
                        <Badge key={p} variant="secondary">{p}</Badge>
                    )) : (
                        <p className="text-muted-foreground text-xs">No individual permissions granted.</p>
                    )}
                </div>
            </div>
        </CardContent>
      </Card>

      <AccessManagementForm 
        permitId={details.permitId} 
        allPermissions={masterPermissions}
        currentPermissionIds={details.permissions}
      />
    </div>
  );
}

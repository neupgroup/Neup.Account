

import { notFound } from "next/navigation";
import { getPermissions, getUserDetails } from "../actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";

export default async function UserPermissionsPage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
    if (!userDetails) {
        notFound();
    }

    const permissions = await getPermissions(params.id);
    
    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/root/users/${params.id}`} />
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Account Permissions</h1>
                <p className="text-muted-foreground">
                    Permissions for @{params.id}.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Assigned Permission Sets</CardTitle>
                    <CardDescription>The user inherits all permissions from these sets.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                             <div className="flex flex-wrap gap-2 mt-1">
                                {permissions.assignedPermissionSets.length > 0 ? (
                                    permissions.assignedPermissionSets.map(p => <Badge key={p} variant="secondary">{p}</Badge>)
                                ) : (
                                    <p className="text-xs text-muted-foreground">No permission sets assigned.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

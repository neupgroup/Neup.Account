
"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { updateUserPermissions } from "@/actions/manage/users";
import type { Permission } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TertiaryHeader } from "@/components/ui/tertiary-header";

type PermissionSet = Omit<Permission, 'access'>;

export function PermissionEditor({
  accountId,
  allPermissionSets,
  initialAssignedSetIds,
  initialRestrictedSetIds,
}: {
  accountId: string;
  allPermissionSets: PermissionSet[];
  initialAssignedSetIds: string[];
  initialRestrictedSetIds: string[];
}) {
  const [assignedSetIds, setAssignedSetIds] = useState<string[]>(initialAssignedSetIds);
  const [restrictedSetIds, setRestrictedSetIds] = useState<string[]>(initialRestrictedSetIds);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleAssignedChange = (permissionId: string, checked: boolean) => {
    setAssignedSetIds((prev) =>
      checked ? [...prev, permissionId] : prev.filter((id) => id !== permissionId)
    );
  };
  
   const handleRestrictedChange = (permissionId: string, checked: boolean) => {
    setRestrictedSetIds((prev) =>
      checked ? [...prev, permissionId] : prev.filter((id) => id !== permissionId)
    );
  };

  const handleSave = () => {
    startTransition(async () => {
        const result = await updateUserPermissions(accountId, assignedSetIds, restrictedSetIds);
        if(result.success) {
            toast({ title: "Success", description: "Permissions updated successfully.", className: "bg-accent text-accent-foreground" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    });
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
            <TertiaryHeader
                title="Assigned Permission Sets"
                description="Grant the user access by assigning one or more permission sets."
            />
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPermissionSets.map((permission) => (
            <div key={permission.id} className="flex items-start space-x-3 rounded-md border p-4">
              <Checkbox
                id={`assign-${permission.id}`}
                checked={assignedSetIds.includes(permission.id)}
                onCheckedChange={(checked) =>
                  handleAssignedChange(permission.id, !!checked)
                }
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor={`assign-${permission.id}`} className="text-sm font-medium cursor-pointer">
                    {permission.name}
                </Label>
                <p className="text-xs text-muted-foreground">{permission.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card className="border-amber-500/50">
        <CardHeader>
             <TertiaryHeader
                title="Restricted Permission Sets"
                description="Explicitly deny permissions, even if they are included in an assigned set. Restrictions always take precedence."
            />
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {allPermissionSets.map((permission) => (
            <div key={permission.id} className="flex items-start space-x-3 rounded-md border p-4">
              <Checkbox
                id={`restrict-${permission.id}`}
                checked={restrictedSetIds.includes(permission.id)}
                onCheckedChange={(checked) =>
                  handleRestrictedChange(permission.id, !!checked)
                }
                className="border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor={`restrict-${permission.id}`} className="text-sm font-medium cursor-pointer">
                    {permission.name}
                </Label>
                 <p className="text-xs text-muted-foreground">{permission.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
        </Button>
      </div>
    </div>
  );
}

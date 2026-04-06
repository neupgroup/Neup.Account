
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { removeAccess, updatePermissions } from "@/services/manage/access";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Permission } from "@/types";
import { Loader2 } from "@/components/icons";
import { redirectInApp } from "@/lib/navigation";

export function AccessManagementForm({
  permitId,
  allPermissions,
  currentPermissionIds,
}: {
  permitId: string;
  allPermissions: Permission[];
  currentPermissionIds: string[];
}) {
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(currentPermissionIds);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setSelectedPermissionIds((prev) =>
      checked
        ? [...prev, permissionId]
        : prev.filter((id) => id !== permissionId)
    );
  };
  
  const handleUpdate = () => {
    startTransition(async () => {
        const result = await updatePermissions(permitId, selectedPermissionIds);
        if (result.success) {
            toast({ title: "Success", description: "Permissions updated successfully.", className: "bg-accent text-accent-foreground"});
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    });
  }

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeAccess(permitId);
      if (result.success) {
        toast({
          title: "Access Revoked",
          description: "The user no longer has access to this account.",
        });
        redirectInApp(router, "/manage/access");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit Permissions</CardTitle>
          <CardDescription>
            Grant or revoke specific permission groups for this user.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {allPermissions.map((permission) => (
            <div key={permission.id} className="flex items-start space-x-2">
              <Checkbox
                id={permission.id}
                checked={selectedPermissionIds.includes(permission.id)}
                onCheckedChange={(checked) =>
                  handlePermissionChange(permission.id, !!checked)
                }
              />
              <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                {permission.name}
              </Label>
            </div>
          ))}
        </CardContent>
        <CardFooter>
            <Button onClick={handleUpdate} disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                Update Permissions
            </Button>
        </CardFooter>
      </Card>
      
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Revoke Access</CardTitle>
          <CardDescription>
            Permanently remove this user's access to the account. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardFooter>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isPending}>
                        Revoke All Access
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently revoke all access for this user. They will no longer be able to manage this account.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemove} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isPending && <Loader2 className="animate-spin" />}
                        Yes, Revoke Access
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/core/hooks/use-toast";
import { removeAccess } from "@/services/manage/access";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "@/components/icons";
import { redirectInApp } from "@/services/navigation";

export function RevokeAccessForm({ permitId }: { permitId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

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
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>Revoke Access</CardTitle>
        <CardDescription>
          Permanently remove this user&apos;s access. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isPending}>
              Revoke Access
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently revoke this user&apos;s access. They will no longer be able to manage this account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isPending && <Loader2 className="animate-spin" />}
                Yes, Revoke Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

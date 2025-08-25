
"use client";

import { useState, useTransition, useContext } from "react";
import { useToast } from "@/hooks/use-toast";
import { requestAccountDeletion } from "@/actions/data/delete";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackButton } from "@/components/ui/back-button";
import { GeolocationContext } from "@/context/geolocation-context";


export default function DeleteAccountPage() {
  const [isPending, startTransition] = useTransition();
  const [isRequested, setIsRequested] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const { toast } = useToast();
  const geo = useContext(GeolocationContext);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;
      const result = await requestAccountDeletion({ password: formData.get('password') as string }, locationString);
      if (result.success) {
        toast({
          title: "Deletion Request Submitted",
          description:
            "Your account is scheduled for deletion in 30 days. Log in anytime within this period to cancel.",
        });
        setIsRequested(true);
        setShowPasswordPrompt(false);
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
    <div className="grid gap-8">
        <BackButton href="/manage/data" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delete Account</h1>
        <p className="text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
      </div>

      <form action={handleSubmit}>
        <Card>
            <CardHeader>
            <CardTitle>Request Account Deletion</CardTitle>
            <CardDescription>
                Please read the following information carefully before proceeding.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <Alert variant="destructive">
                <AlertTitle>This action is irreversible.</AlertTitle>
                <AlertDescription>
                <ul className="list-disc space-y-2 pl-5 mt-2">
                    <li>
                    A <strong>30-day cool-off period</strong> will begin once you
                    request deletion.
                    </li>
                    <li>
                    Logging in during this 30-day period will{" "}
                    <strong>automatically cancel</strong> the deletion request.
                    </li>
                    <li>
                    After 30 days, your account will be permanently inaccessible.
                    A final request will be sent to an administrator for the
                    complete erasure of your data from our systems.
                    </li>
                </ul>
                </AlertDescription>
            </Alert>
            {isRequested && (
                <Alert variant="default" className="border-primary text-primary [&>svg]:text-primary">
                    <AlertTitle>Request Received</AlertTitle>
                    <AlertDescription>
                        Your account deletion request has been submitted. You have 30 days to cancel this request by signing in.
                    </AlertDescription>
                </Alert>
            )}
             {showPasswordPrompt && !isRequested && (
                <div className="space-y-2 pt-4">
                    <Label htmlFor="password">Enter your password to confirm</Label>
                    <Input id="password" name="password" type="password" required autoFocus />
                </div>
            )}
            </CardContent>
            <CardFooter>
                 {!showPasswordPrompt && !isRequested && (
                    <Button type="button" onClick={() => setShowPasswordPrompt(true)} variant="destructive">
                         <Trash2 className="mr-2 h-4 w-4" />
                        Request Account Deletion
                    </Button>
                 )}
                 {showPasswordPrompt && !isRequested && (
                     <Button variant="destructive" disabled={isPending}>
                        {isPending ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Trash2 className="mr-2 h-4 w-4" />)}
                        Confirm Deletion
                    </Button>
                 )}
                 {isRequested && (
                     <Button variant="destructive" disabled>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deletion Requested
                    </Button>
                 )}
            </CardFooter>
        </Card>
      </form>
    </div>
  );
}

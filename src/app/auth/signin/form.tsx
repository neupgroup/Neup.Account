
"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useState, useEffect, useContext, useTransition } from "react"
import { useToast } from "@/hooks/use-toast"
import { loginUser } from "@/actions/auth/signin"
import { validateNeupId } from "@/lib/user"
import { cancelAccountDeletion } from "@/actions/data/delete"
import NProgress from 'nprogress'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GeolocationContext } from "@/context/geolocation-context"
import { Loader2 } from "@/components/icons"

export default function SigninForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const geo = useContext(GeolocationContext);

  const [step, setStep] = useState(1)
  const [neupId, setNeupId] = useState("")
  const [password, setPassword] = useState("")
  
  const [isCheckingNeupId, startNeupIdCheck] = useTransition();
  const [isSubmitting, startPasswordSubmit] = useTransition();

  const [isRedirecting, setIsRedirecting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false)
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);

  useEffect(() => {
    setIsClient(true)
  }, [])

  const neupIdFromQuery = searchParams.get("neupId");

  useEffect(() => {
    if (neupIdFromQuery) {
        setNeupId(neupIdFromQuery.toLowerCase());
        setStep(2);
    }
  }, [neupIdFromQuery]);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'session_expired') {
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Your session has expired. Please sign in again.",
      });
      // A clean way to remove the error from the URL without a full page reload.
      router.replace('/auth/signin', { scroll: false });
    }
  }, [searchParams, toast, router]);

  const handleNeupIdSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null);
    startNeupIdCheck(async () => {
        NProgress.start();
        const result = await validateNeupId(neupId);
        if (result.success || result.error === 'pending_deletion') {
            setStep(2);
        } else {
            setValidationError(result.error || 'Invalid NeupID.');
        }
        NProgress.done();
    });
  }

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startPasswordSubmit(async () => {
        NProgress.start();
        try {
            const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;
            const result = await loginUser({ neupId: neupId.toLowerCase(), password, geolocation: locationString });
            
            if (result.success) {
                setIsRedirecting(true);
                router.push("/manage");
                // router.refresh() will be triggered by NProgressEvents on navigation
            } else if (result.error === 'pending_deletion') {
                setShowDeletionDialog(true);
                NProgress.done();
            } else {
                toast({
                variant: "destructive",
                title: "Sign In Failed",
                description: result.error || "An unexpected error occurred.",
                });
                NProgress.done();
            }
        } catch (error) {
            console.error("Sign In error:", error)
            toast({
                variant: "destructive",
                title: "Sign In Failed",
                description: "An unexpected error occurred. Please try again.",
            });
            NProgress.done();
        }
    });
  }
  
  const handleCancelDeletion = async () => {
    setShowDeletionDialog(false);
    startPasswordSubmit(async () => {
        const neupidsRef = doc(db, 'neupid', neupId);
        const neupidsSnapshot = await getDoc(neupidsRef);
        const accountId = neupidsSnapshot.data()?.for;
        if (!accountId) {
             toast({ variant: "destructive", title: "Error", description: "Could not find account to cancel deletion." });
             return;
        }

        const result = await cancelAccountDeletion(accountId);
        if (result.success) {
            toast({ title: "Deletion Cancelled", description: "Your account deletion request has been cancelled. Welcome back!", className: "bg-accent text-accent-foreground" });
            // Re-attempt login
            const loginForm = document.getElementById("password-form") as HTMLFormElement;
            if(loginForm) handlePasswordSubmit(new Event('submit') as any);
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error || "Could not cancel deletion." });
        }
    });
  }

  const handleProceedWithDeletion = () => {
    setShowDeletionDialog(false);
    router.push('/auth/accounts');
  }

  const handleBack = () => {
    setStep(1)
    setNeupId("")
    setValidationError(null);
  }

  const handleNeupIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setNeupId(value);
    if(validationError) setValidationError(null);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
            {step === 1 && (
                <>
                    <div className="flex justify-start items-center mb-4">
                        
                    </div>
                    <CardTitle className="text-2xl font-headline">Sign in with Neup.Account</CardTitle>
                    <CardDescription>
                        Sign in with your NeupID to access NeupID Group Products and Services
                    </CardDescription>
                </>
            )}
            {step === 2 && (
                 <>
                    <CardTitle className="text-2xl font-headline">
                        Welcome back,
                    </CardTitle>
                    <CardDescription>
                        @{neupId}, enter your password and you're a step closer to getting into your NeupID.
                    </CardDescription>
                 </>
            )}
        </CardHeader>
        <CardContent>
            {step === 1 && (
                <form onSubmit={handleNeupIdSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="neupId">NeupID</Label>
                        <div className="relative">
                            <Input
                                id="neupId"
                                name="neupId"
                                type="text"
                                placeholder="neupid"
                                required
                                autoFocus
                                value={neupId}
                                onChange={handleNeupIdChange}
                                className="pr-10"
                            />
                            {isCheckingNeupId && (
                                <div className="absolute inset-y-0 right-3 flex items-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                         {validationError && (
                            <p className="text-sm text-destructive">{validationError}</p>
                        )}
                    </div>
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isCheckingNeupId}>
                        Next
                    </Button>
                    <div className="mt-4 text-left text-sm">
                        Don&apos;t have an Account?{" "}
                        {isClient && 
                            <Link href="/auth/signup" className="underline text-primary">
                                <span>Sign Up</span>
                            </Link>
                        }
                    </div>
                </form>
            )}
            {step === 2 && (
                 <form id="password-form" onSubmit={handlePasswordSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting || isRedirecting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Sign In'}
                    </Button>
                    <div className="flex justify-between items-center text-sm">
                        <Link href="/auth/forget" className="underline text-primary">
                            Forget Password
                        </Link>
                        <Button variant="link" type="button" onClick={handleBack} className="text-primary p-0 h-auto">
                            Back
                        </Button>
                    </div>
                 </form>
            )}
        </CardContent>
      </Card>
      
        <AlertDialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Account Deletion Pending</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your account is scheduled for deletion. Continuing to sign in will cancel this request. Do you want to proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleProceedWithDeletion}>Log Out</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelDeletion} disabled={isSubmitting}>
                         {isSubmitting ? <Loader2 className="animate-spin" /> : 'Cancel Deletion & Sign In'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}

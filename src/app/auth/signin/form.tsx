
"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useState, useEffect, useContext } from "react"
import { useToast } from "@/hooks/use-toast"
import { loginUser } from "@/lib/auth-actions"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GeolocationContext } from "@/context/geolocation-context"

export default function SigninForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const geo = useContext(GeolocationContext);

  const [step, setStep] = useState(1)
  const [neupId, setNeupId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false);
  
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
    const enteredNeupId = (event.currentTarget.elements.namedItem('neupId') as HTMLInputElement).value
    if (enteredNeupId) {
        setNeupId(enteredNeupId.toLowerCase())
        setStep(2)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    const password = (event.currentTarget.elements.namedItem('password') as HTMLInputElement).value
    const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;

    try {
      const result = await loginUser({ neupId: neupId.toLowerCase(), password, geolocation: locationString });
      
      if (result.success) {
        setIsRedirecting(true);
        router.push("/manage");
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: result.error || "An unexpected error occurred.",
        })
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
      })
      setIsSubmitting(false)
    }
  }
  
  const handleBack = () => {
    setStep(1)
    setNeupId("")
  }

  const getButtonText = () => {
    if (isRedirecting) return "Redirecting to dashboard...";
    if (isSubmitting) return "Logging in...";
    return "Login";
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
            {step === 1 && (
                <>
                    <div className="flex justify-start items-center mb-4">
                        
                    </div>
                    <CardTitle className="text-2xl font-headline">Sign in with NeupID</CardTitle>
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
                        <Input
                            id="neupId"
                            name="neupId"
                            type="text"
                            placeholder="your-neup-id"
                            required
                            autoFocus
                            defaultValue={neupId}
                            onChange={(e) => e.target.value = e.target.value.toLowerCase()}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                        Next
                    </Button>
                    <div className="mt-4 text-left text-sm">
                        Don&apos;t have an NeupID?{" "}
                        <Link href="/auth/signup" className="underline text-primary">
                            Sign Up
                        </Link>
                    </div>
                </form>
            )}
            {step === 2 && (
                 <form onSubmit={handlePasswordSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            autoFocus
                        />
                    </div>
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting || isRedirecting}>
                        {getButtonText()}
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
    </div>
  )
}

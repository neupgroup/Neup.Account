
"use client"

import { useState, useContext, useEffect, useCallback, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import NProgress from 'nprogress'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GeolocationContext } from "@/context/geolocation-context"
import { initializeSignup } from "@/actions/auth/signup"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "@/components/icons"

export default function RegisterPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitting, startTransition] = useTransition()


    const handleStart = () => {
      startTransition(async () => {
        NProgress.start();
        const result = await initializeSignup();
        if (result.success) {
            router.push('/auth/signup/personal');
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not start the signup process. Please try again."
            })
            NProgress.done();
        }
      });
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-card md:bg-background py-12 md:items-center md:py-0">
            <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
                <CardHeader>
                    <div className="flex justify-start items-center mb-4">
                        
                    </div>
                    <CardTitle className="text-2xl font-headline">Create your Neup.Account</CardTitle>
                    <CardDescription>A single, secure account to access all NeupID services.</CardDescription>
                </CardHeader>
                <CardContent>
                   <p className="text-sm text-muted-foreground">Click the button below to start the registration process. We'll guide you through setting up your new account step by step.</p>
                </CardContent>

                <CardFooter className="flex-col items-start gap-4">
                    <Button onClick={handleStart} className="w-full" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="animate-spin mr-2"/>}
                        Create Account
                    </Button>
                     <div className="mt-4 text-center text-sm w-full">
                        Already have an account?{" "}
                        <Link href="/auth/signin" className="underline text-primary">
                            Sign In
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}

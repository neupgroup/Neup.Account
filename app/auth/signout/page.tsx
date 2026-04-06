
"use client"

import { useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { logoutActiveSession } from "@/services/auth/signout"
import { redirectInApp } from "@/lib/navigation"

function SignOut() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const formRef = useRef<HTMLFormElement>(null)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.clear();
        }

        const timer = setTimeout(() => {
            if (formRef.current) {
                formRef.current.requestSubmit();
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [])

    const handleSignOut = async () => {
        try {
            await logoutActiveSession()
        } catch (error) {
            console.error("Sign-out failed:", error)
        } finally {
            const errorParam = searchParams.get('error');
            const errorDescParam = searchParams.get('error_description');

            let redirectUrl = "/";
            if (errorParam) {
                redirectUrl = `/auth/signin?error=${errorParam}&error_description=${errorDescParam || 'Please sign in again.'}`;
            }

            redirectInApp(router, redirectUrl);
            router.refresh();
        }
    }

    return (
        <form ref={formRef} action={handleSignOut} className="hidden">
            <button type="submit">Signing out...</button>
        </form>
    )
}

export default function SignOutPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignOut />
        </Suspense>
    )
}

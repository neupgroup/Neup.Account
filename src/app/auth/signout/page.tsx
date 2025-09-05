
"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { logoutActiveSession } from "@/actions/auth/signout"

// This page handles the sign-out process.
// It uses a client-side effect to call a server action,
// which is a reliable way to modify cookies.
// It renders nothing visible to the user.

export default function SignOutPage() {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)

    // We use a one-time effect to submit a form that calls our server action.
    // This ensures the action runs in the correct context.
    useEffect(() => {
        // Clear client-side session cache immediately on sign out.
        if (typeof window !== 'undefined') {
            sessionStorage.clear();
        }

        // The timeout gives React a moment to render the component,
        // preventing potential "form not connected" warnings.
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
            // After the server action is done, redirect to the homepage.
            router.push("/")
            // It's good practice to refresh the router state.
            router.refresh()
        }
    }

    return (
        <form ref={formRef} action={handleSignOut} className="hidden">
            <button type="submit">Signing out...</button>
        </form>
    )
}

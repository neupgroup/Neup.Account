
"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { switchToPersonal } from "@/app/manage/brand/actions"

export default function SwitchbackPage() {
    const router = useRouter()
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;
        
        async function handleSwitch() {
            await switchToPersonal();
            router.push("/manage");
            router.refresh();
        }

        handleSwitch();
    }, [router]);

    return (
        <div className="flex h-screen items-center justify-center">
            <p>Please wait, switching back to your personal account...</p>
        </div>
    )
}

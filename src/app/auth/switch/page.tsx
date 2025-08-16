
"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { getCookie, deleteCookie } from 'cookies-next';

export default function SwitchPage() {
    const router = useRouter()
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const managingCookie = getCookie('auth_managing');

        if (managingCookie) {
            // If managing, switch back to personal by deleting the cookie
            deleteCookie('auth_managing', { path: '/' });
            router.push("/manage");
            router.refresh();
        } else {
            // If not managing, go to the brand selection page
            router.push("/manage/brand");
            router.refresh();
        }
    }, [router]);

    return (
        <div>
            <p>Please wait, switching accounts...</p>
        </div>
    )
}



"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getActiveAccountId } from "@/lib/auth-actions"
import { getUserProfile, type UserProfile, getUserNeupIds } from "@/lib/user-actions"
import { getCookie } from "cookies-next"
import { switchToPersonal } from "@/app/manage/accounts/brand/actions"
import { useTransition } from "react"
import { useRouter } from "next/navigation"

type ManagedAccount = {
    type: 'brand';
    id: string;
} | null;

export function UserNav() {
    const [user, setUser] = useState<UserProfile | null>(null)
    const [userNeupId, setUserNeupId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [managing, setManaging] = useState<ManagedAccount>(null);
    const [managedProfile, setManagedProfile] = useState<UserProfile | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();


    useEffect(() => {
        async function fetchUser() {
            setLoading(true)

            // Check for managed account cookie
            const managingCookie = getCookie('auth_managing');
            if (typeof managingCookie === 'string' && managingCookie.startsWith('brand.')) {
                const [type, id] = managingCookie.split('.');
                setManaging({ type: type as 'brand', id });
                const [brandProfile, brandNeupIds] = await Promise.all([
                    getUserProfile(id),
                    getUserNeupIds(id)
                ]);
                setManagedProfile(brandProfile);
                setUserNeupId(brandNeupIds[0] || null);

            } else {
                setManaging(null);
                setManagedProfile(null);
            }

            // Fetch personal account
            const personalId = await getActiveAccountId()
            if (personalId) {
                const profile = await getUserProfile(personalId)
                setUser(profile)
                if (!managing) {
                    const neupIds = await getUserNeupIds(personalId);
                    setUserNeupId(neupIds[0] || null);
                }
            }
            setLoading(false)
        }
        fetchUser()
    }, [isPending])
    
    const handleSwitchToPersonal = () => {
        startTransition(async () => {
            await switchToPersonal();
            router.refresh();
        });
    }

    if (loading) {
        return <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
    }

    if (!user) {
        return null
    }

    const personalInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    const personalDisplayName = user.displayName || `${user.firstName} ${user.lastName}`
    
    const activeProfile = managing ? managedProfile : user;
    const activeDisplayName = managing ? (activeProfile?.displayName || 'Brand') : personalDisplayName;
    const activeInitials = managing ? (activeProfile?.displayName?.[0] || 'B') : personalInitials;


    return (
         <div className="relative h-8 flex items-center justify-end gap-2 p-0">
            <div className="text-right">
                <p className="text-sm font-medium">{activeDisplayName}</p>
                {userNeupId && <p className="text-xs text-muted-foreground font-mono">@{userNeupId}</p>}
            </div>
            <Avatar className="h-9 w-9">
                <AvatarImage src={activeProfile?.displayPhoto} alt={activeDisplayName} data-ai-hint="person logo" />
                <AvatarFallback>{activeInitials}</AvatarFallback>
            </Avatar>
        </div>
    )
}

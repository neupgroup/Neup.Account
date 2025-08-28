'use client';

import Link from "next/link";
import React, { useMemo } from "react";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    UserCircle,
    Key,
    type LucideIcon,
    Home,
    FolderGit2,
    Database,
    Combine,
    HeartHandshake,
    Gem,
    Users,
    LogOut,
    ArrowLeft,
    AppWindow,
    AlertTriangle,
    Wallet,
    ShieldCheck,
    Clock,
} from "@/components/icons";
import { type NavSection, navItems, navIcons, allPermissionsMap } from "./nav-data";
import { NotificationBell } from "./warning-display";
import { ListItem } from "./ui/list-item";
import { useSession } from "@/context/session-context";
import { Skeleton } from "./ui/skeleton";


const iconMap: { [key: string]: LucideIcon | React.ElementType } = {
    Home: Home,
    "PersonalInfo": UserCircle,
    "Notifications": NotificationBell,
    "PasswordAndSecurity": Key,
    "LinkedAccounts": Combine,
    "DataAndPrivacy": Database,
    "AccessAndControl": FolderGit2,
    "PeopleAndSharing": HeartHandshake,
    "PaymentAndSubscription": Gem,
    "SwitchAccount": Users,
    "SignOutAccount": LogOut,
    "SwitchBack": ArrowLeft,
    "Dashboard": Home,
    "Account Management": Users,
    "Requests Management": Clock,
    "PermissionManagement": ShieldCheck,
    "AppManagement": AppWindow,
    "SystemErrors": AlertTriangle,
    "PaymentDetails": Wallet,
    "BrandInfo": UserCircle,
    UserCircle: UserCircle, // Fallback
}

export function MobileNav() {
    const { permissions, isManaging, profile, loading } = useSession();

    const navConfig: NavSection[] | null = useMemo(() => {
        if (loading || !permissions) return null;

        const userPermissionSet = new Set(permissions);
        const hasAnyPermissionFor = (requiredPermissions: string[]) => {
            if (requiredPermissions.length === 0) return true;
            return requiredPermissions.some(p => userPermissionSet.has(p));
        };

        const navItemsWithPerms = (items: Omit<any, 'requiredPermissions' | 'iconName'>[]): any[] => {
            return items.map(item => ({
                ...item,
                iconName: navIcons[item.label] || "UserCircle",
                requiredPermissions: allPermissionsMap[item.label] || []
            })).filter(item => hasAnyPermissionFor(item.requiredPermissions));
        };
        
        const accountNavItems = isManaging
            ? navItems.accountNav.map(item => 
                item.label === "Switch Account" ? { ...item, href: '/auth/switch' } : item
              )
            : navItems.accountNav;

        const visibleNeupIdNav = navItemsWithPerms(navItems.neupIdNav);
        const visibleManagementNav = navItemsWithPerms(navItems.managementNav);
        const visibleAccountNav = navItemsWithPerms(accountNavItems);
        
        const primaryNeupId = profile?.neupId ? `@${profile.neupId}` : 'Neup.Account';

        const config: NavSection[] = [];
        
        if (isManaging) {
            config.push({ title: profile?.displayName || "Brand", items: [
                { href: "/manage/home", label: "Dashboard", description: "Your central account management hub.", iconName: "Dashboard", requiredPermissions: [] },
                { href: "/manage/profile", label: "Brand Info", description: "Manage brand profile.", iconName: "BrandInfo", requiredPermissions: ['profile.view'] },
                { href: "/manage/accounts/branches", label: "Branches", description: "Manage brand branches.", iconName: "LinkedAccounts", requiredPermissions: ['linked_accounts.brand.manage'] },
            ]});
             config.push({ title: "Account", items: visibleAccountNav });
        } else {
            if (visibleNeupIdNav.length > 0) {
                config.push({ title: primaryNeupId, items: visibleNeupIdNav });
            }
            if (visibleManagementNav.length > 0) {
                config.push({ title: "Management", items: visibleManagementNav });
            }
            if (visibleAccountNav.length > 0) {
                config.push({ title: "Account", items: visibleAccountNav });
            }
        }

        return config;
    }, [permissions, isManaging, profile, loading]);

    if (loading || !navConfig) {
        return (
            <div className="grid gap-8">
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight">Neup.Account</h1>
                    <p className="text-muted-foreground">
                        Navigate to different sections of your account.
                    </p>
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    <Card><CardContent className="p-0 divide-y"><ListItemSkeleton /><ListItemSkeleton /><ListItemSkeleton /></CardContent></Card>
                </div>
            </div>
        )
    }

    return (
        <div className="grid gap-8">
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Neup.Account</h1>
                <p className="text-muted-foreground">
                    Navigate to different sections of your account.
                </p>
            </div>
            {navConfig.map((section: NavSection) => (
                 <div key={section.title || 'main'} className="space-y-2">
                    {section.title && <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>}
                     <Card>
                        <CardContent className="divide-y p-0">
                           {section.items.map((item, index) => (
                               <ListItem key={index} href={item.href} title={item.label} description={item.description} icon={iconMap[item.iconName] || UserCircle} />
                            ))}
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}

const ListItemSkeleton = () => (
    <div className="flex items-center gap-4 py-4 px-4">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex-grow space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-5 w-5" />
    </div>
)

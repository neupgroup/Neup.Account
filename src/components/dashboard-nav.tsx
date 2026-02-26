'use client';

import Link from "next/link"
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { type NavSection, navItems, allPermissionsMap } from "./nav-data"
import { Skeleton } from "./ui/skeleton";
import { useSession } from "@/context/session-context";

export function DashboardNav() {
    const pathname = usePathname();
    const { permissions, isManaging, profile, loading } = useSession();

    const navConfig: NavSection[] | null = useMemo(() => {
        if (loading || !permissions) return null;

        const permissionsSet = new Set(permissions);
        const hasAnyPermissionFor = (requiredPermissions: string[]) => {
            if (requiredPermissions.length === 0) return true;
            return requiredPermissions.some(p => permissionsSet.has(p));
        };

        const navItemsWithPerms = (items: Omit<any, 'requiredPermissions' | 'iconName'>[]): any[] => {
            return items.map(item => ({
                ...item,
                requiredPermissions: allPermissionsMap[item.label] || []
            })).filter(item => hasAnyPermissionFor(item.requiredPermissions));
        };
        
        const accountNavItems = isManaging
            ? navItems.accountNav.map(item => 
                item.label === "Switch Account" ? { ...item, href: '/auth/switchback' } : item
              )
            : navItems.accountNav;

        const visibleNeupIdNav = navItemsWithPerms(navItems.neupIdNav);
        const visibleManagementNav = navItemsWithPerms(navItems.managementNav);
        const visibleAccountNav = navItemsWithPerms(accountNavItems);
        
        const primaryNeupId = profile?.neupIdPrimary ? `@${profile.neupIdPrimary}` : 'Neup.Account';
        const title = isManaging ? profile?.nameDisplay : primaryNeupId;


        const config: NavSection[] = [];
        
        if (isManaging) {
            config.push({ title: title || "Brand", items: [
                { href: "/home", label: "Dashboard", description: "Your central account management hub." },
                { href: "/profile", label: "Brand Info", description: "Manage brand profile." },
                { href: "/accounts/branches", label: "Branches", description: "Manage brand branches." },
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
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <nav className="grid items-start gap-2 text-sm font-medium">
            {navConfig.map((section: NavSection) => (
                <div key={section.title} className="mt-4 first:mt-0">
                    {section.title && (
                         <div className="flex justify-between items-center px-3 py-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                            <span>{section.title}</span>
                        </div>
                    )}
                     <div className="flex flex-col gap-1">
                        {section.items.map((item) => {
                             const isActive = item.href === '/home' 
                                ? pathname === item.href || pathname === '/'
                                : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    data-active={isActive}
                                    className={cn(buttonVariants({ variant: "ghost", size: "default" }), "justify-start text-base md:text-sm")}
                                >
                                    {item.label}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            ))}
        </nav>
    )
}
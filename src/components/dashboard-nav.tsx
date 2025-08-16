

'use client';

import Link from "next/link"
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { getNavConfig, type NavSection } from "./nav-data"
import { Skeleton } from "./ui/skeleton";
import { NotificationBell } from "./warning-display";

export function DashboardNav() {
    const pathname = usePathname();
    const [navConfig, setNavConfig] = useState<NavSection[] | null>(null);

    useEffect(() => {
        getNavConfig().then(config => setNavConfig(config));
    }, [pathname]); // Re-fetch config if pathname changes, for managing/personal switch

    if (!navConfig) {
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
                             const isActive = item.href === '/manage/home' 
                                ? pathname === item.href || pathname === '/manage'
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

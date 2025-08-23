
"use client";

import Link from "next/link";
import React from "react";
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
    ChevronRight,
    Users,
    LogOut,
    ArrowLeft,
    AppWindow,
    AlertTriangle,
    Wallet,
    ShieldCheck,
    Clock,
    Bell,
} from "@/components/icons";
import { NotificationBell } from "../warning-display";


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

type Item = {
    iconName: string;
    label: string;
    description: string;
    href: string;
}

const SettingsListItem = ({
    iconName,
    title,
    description,
    href,
}: {
    iconName: string;
    title: string;
    description: string;
    href: string;
}) => {
    const Icon = iconMap[iconName] || UserCircle;
    return (
        <Link href={href} className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50">
            <Icon className="h-6 w-6 text-muted-foreground" />
            <div className="flex-grow">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    );
}

export function HomeNavList({ items }: { items: Item[]}) {
    // The "Home" item should not be displayed in its own list.
    const excludedHrefs = ['/manage/home'];
    const visibleItems = items.filter(item => !excludedHrefs.includes(item.href));

     if (visibleItems.length === 0) {
        return (
            <Card>
                <CardContent className="p-4 text-left">
                    <p className="text-sm text-muted-foreground">You do not have permission to view any settings in this section.</p>
                </CardContent>
            </Card>
        )
    }

    return (
         <div className="space-y-2">
            <Card>
                <CardContent className="divide-y p-0">
                    {visibleItems.map((item, index) => (
                        <SettingsListItem 
                            key={index}
                            href={item.href}
                            title={item.label}
                            description={item.description}
                            iconName={item.iconName}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

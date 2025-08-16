
import { Card, CardContent } from "@/components/ui/card";
import { AppWindow, Share2, ChevronRight, Building, BarChart, FileText, Trash2, PowerOff, CalendarClock, History } from "lucide-react";
import Link from "next/link";
import React from "react";
import { getConnectedApplications, type Application } from "./actions";

const ICON_MAP: Record<Application['icon'], React.ElementType> = {
    'app-window': AppWindow,
    'building': Building,
    'bar-chart': BarChart,
    'share-2': Share2,
};

const FeatureListItem = ({
    icon: IconComponent,
    title,
    description,
    href,
}: {
    icon: React.ElementType,
    title: string,
    description: string,
    href: string,
}) => (
    <Link href={href} className="flex items-center gap-4 py-3 px-2 rounded-lg transition-colors hover:bg-muted/50">
        <IconComponent className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);


export default async function DataAndPrivacyPage() {
    
    const { firstParty, thirdParty } = await getConnectedApplications();
    
    const privacyFeatures = [
         {
            icon: History,
            title: "Your Account Activity",
            description: "View a log of recent actions performed on your account.",
            href: "/manage/data/activity",
        },
        {
            icon: FileText,
            title: "Agreed Terms",
            description: "Review terms and conditions you have agreed to.",
            href: "/manage/data/policies",
        },
        {
            icon: Trash2,
            title: "Delete Your Account",
            description: "Permanently delete your account and associated data.",
            href: "/manage/data/delete",
        },
        {
            icon: PowerOff,
            title: "Deactivate Your Account",
            description: "Temporarily deactivate your account.",
            href: "/manage/data/deactivate",
        },
        {
            icon: CalendarClock,
            title: "Schedule Deletion (Materialization)",
            description: "Request data deletion after a period of inactivity.",
            href: "/manage/data/materialization",
        },
    ];

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Your Data</h1>
                <p className="text-muted-foreground">
                    Manage and understand how your data is used across Neup services.
                </p>
            </div>
            
             <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Privacy Features</h2>
                <p className="text-muted-foreground text-sm">
                    Control your privacy settings and manage your data.
                </p>
                <Card>
                    <CardContent className="divide-y p-2">
                        {privacyFeatures.map((feature, index) => (
                            <FeatureListItem key={index} {...feature} />
                        ))}
                    </CardContent>
                </Card>
            </div>

            {firstParty.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">Data within Neup Group</h2>
                    <p className="text-muted-foreground text-sm">
                        Your data is shared across Neup Group services to provide a seamless experience. Review each service to understand how your data is used.
                    </p>
                    <Card>
                        <CardContent className="divide-y p-2">
                            {firstParty.map((app) => (
                                <FeatureListItem 
                                    key={app.id}
                                    icon={ICON_MAP[app.icon] || AppWindow}
                                    title={app.name}
                                    description={app.description}
                                    href={`/manage/data/1/${app.id}`} 
                                />
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {thirdParty.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">Third-party Access</h2>
                    <p className="text-muted-foreground text-sm">
                        Control how your data is accessed by other applications and services.
                    </p>
                    <Card>
                        <CardContent className="divide-y p-2">
                            {thirdParty.map((app) => (
                                <FeatureListItem 
                                    key={app.id}
                                    icon={ICON_MAP[app.icon] || Share2}
                                    title={app.name}
                                    description={app.description}
                                    href={`/manage/data/3/${app.id}`} 
                                />
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

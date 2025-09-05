
import { Card, CardContent } from "@/components/ui/card";
import React from "react";
import { getConnectedApplications } from "@/actions/data/applications";
import { ListItem } from "@/components/ui/list-item";
import { SecondaryHeader } from "@/components/ui/secondary-header";

export default async function DataAndPrivacyPage() {
    
    const { firstParty, thirdParty } = await getConnectedApplications();
    
    const privacyFeatures = [
         {
            icon: "History",
            title: "Your Account Activity",
            description: "View a log of recent actions performed on your account.",
            href: "/manage/data/activity",
        },
        {
            icon: "FileText",
            title: "Agreed Terms",
            description: "Review terms and conditions you have agreed to.",
            href: "/manage/data/policies",
        },
        {
            icon: "Trash2",
            title: "Delete Your Account",
            description: "Permanently delete your account and associated data.",
            href: "/manage/data/delete",
        },
        {
            icon: "PowerOff",
            title: "Deactivate Your Account",
            description: "Temporarily deactivate your account.",
            href: "/manage/data/deactivate",
        },
        {
            icon: "CalendarClock",
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
                <Card>
                    <CardContent className="divide-y p-2">
                        {privacyFeatures.map((feature, index) => (
                            <ListItem key={index} {...feature} />
                        ))}
                    </CardContent>
                </Card>
            </div>

            {firstParty.length > 0 && (
                <div className="space-y-2">
                    <SecondaryHeader 
                        title="Data within Neup Group"
                        description="Your data is shared across Neup Group services to provide a seamless experience. Review each service to understand how your data is used."
                    />
                    <Card>
                        <CardContent className="divide-y p-2">
                            {firstParty.map((app) => (
                                <ListItem 
                                    key={app.id}
                                    icon={app.icon || "AppWindow"}
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
                    <SecondaryHeader
                        title="Third-party Access"
                        description="Control how your data is accessed by other applications and services."
                    />
                    <Card>
                        <CardContent className="divide-y p-2">
                            {thirdParty.map((app) => (
                                <ListItem 
                                    key={app.id}
                                    icon={app.icon || "Share2"}
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

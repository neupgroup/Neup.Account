

import { Card, CardContent } from "@/components/ui/card";
import { Users, Contact, UserX, ChevronRight, MailQuestion } from "lucide-react";
import Link from "next/link";
import React from "react";
import { checkPermissions } from "@/lib/user-actions";


const FeatureListItem = ({
    icon: Icon,
    title,
    description,
    href,
}: {
    icon: React.ElementType,
    title: string,
    description: string,
    href: string,
}) => (
    <Link href={href} className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50">
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);


export default async function PeopleSharingPage() {
    const [canViewFamily, canViewInvitations] = await Promise.all([
        checkPermissions(['people.family.view']),
        checkPermissions(['notification.read'])
    ]);
    
    const sharingFeatures = [
        {
            icon: Users,
            title: "Family Sharing",
            description: "Manage your family group and shared subscriptions.",
            href: "/manage/people/family",
            show: canViewFamily,
        },
        {
            icon: MailQuestion,
            title: "Invitations",
            description: "Accept or reject requests from other users.",
            href: "/manage/people/invitations",
            show: canViewInvitations,
        },
        {
            icon: Contact,
            title: "Contact Info Sharing",
            description: "Control how your contact information is shared.",
            href: "#",
            show: false, // Not implemented yet
        },
        {
            icon: UserX,
            title: "Blocked Users",
            description: "See a list of people you've blocked.",
            href: "#",
            show: false, // Not implemented yet
        },
    ];

    const visibleFeatures = sharingFeatures.filter(f => f.show);

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">People & Sharing</h1>
                <p className="text-muted-foreground">
                    Control what you share and who you share it with across NeupID services.
                </p>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Sharing Settings</h2>
                <p className="text-muted-foreground text-sm">
                    Manage how your information is shared with other people.
                </p>
                <Card>
                    <CardContent className="divide-y p-2">
                        {visibleFeatures.length > 0 ? (
                            visibleFeatures.map((feature, index) => (
                                <FeatureListItem key={index} {...feature} />
                            ))
                        ) : (
                             <div className="p-4 text-center text-sm text-muted-foreground">
                                You do not have permission to view sharing settings.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

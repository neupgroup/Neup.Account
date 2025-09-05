
import { Card, CardContent } from "@/components/ui/card";
import { Users, MailQuestion, Contact, UserX } from "@/components/icons";
import React from "react";
import { checkPermissions } from "@/lib/user";
import { ListItem } from "@/components/ui/list-item";
import { SecondaryHeader } from "@/components/ui/secondary-header";
import { PrimaryHeader } from "@/components/ui/primary-header";


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
            <PrimaryHeader
                title="People & Sharing"
                description="Control what you share and who you share it with across NeupID services."
            />
            
            <div className="grid gap-4">
                <SecondaryHeader
                    title="Sharing Settings"
                    description="Manage how your information is shared with other people."
                />
                <Card>
                    <CardContent className="divide-y p-0">
                        {visibleFeatures.length > 0 ? (
                            visibleFeatures.map((feature, index) => (
                                <ListItem key={index} {...feature} />
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

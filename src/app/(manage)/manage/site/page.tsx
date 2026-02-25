
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, AlertTriangle, Bug, Share2 } from "@/components/icons";
import React from "react";
import { checkPermissions } from "@/lib/user";
import { notFound } from "next/navigation";
import { ListItem } from "@/components/ui/list-item";

export default async function SiteConfigurationPage() {
    const [canViewPayment, canViewErrors, canViewSocials] = await Promise.all([
        checkPermissions(['root.payment_config.view']),
        checkPermissions(['root.errors.view']),
        checkPermissions(['root.site.social_accounts.read']),
    ]);
    
    const canViewPage = canViewPayment || canViewErrors || canViewSocials;
    if (!canViewPage) {
        notFound();
    }

    const features = [
        {
            icon: Wallet,
            title: "Payment Configuration",
            description: "Configure payment instructions for users purchasing Neup.Pro.",
            href: "/manage/site/payment",
            show: canViewPayment,
        },
        {
            icon: AlertTriangle,
            title: "System Errors",
            description: "View a log of all system-level errors captured by the logger.",
            href: "/manage/site/errors",
            show: canViewErrors,
        },
        {
            icon: Bug,
            title: "Reported Bugs",
            description: "Review bugs and issues reported by users.",
            href: "/manage/site/bugs",
            show: canViewErrors,
        },
        {
            icon: Share2,
            title: "Social Sites",
            description: "Manage the company's social media links.",
            href: "/manage/site/socials",
            show: canViewSocials,
        },
    ];

    const visibleFeatures = features.filter(f => f.show);

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Site Configuration</h1>
                <p className="text-muted-foreground">
                    Manage site-wide settings, payment details, and error logs.
                </p>
            </div>
             <div className="space-y-2">
                <Card>
                    <CardContent className="divide-y p-2">
                        {visibleFeatures.map((feature, index) => (
                            <ListItem key={index} {...feature} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

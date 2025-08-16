
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, AlertTriangle, Bug, ChevronRight, Share2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import { checkPermissions } from "@/lib/user-actions";
import { notFound } from "next/navigation";

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
            href: "/manage/root/site/payment",
            show: canViewPayment,
        },
        {
            icon: AlertTriangle,
            title: "System Errors",
            description: "View a log of all system-level errors captured by the logger.",
            href: "/manage/root/site/errors",
            show: canViewErrors,
        },
        {
            icon: Bug,
            title: "Reported Bugs",
            description: "Review bugs and issues reported by users.",
            href: "/manage/root/site/bugs",
            show: true, // Assuming anyone who can see this page can see the link
        },
        {
            icon: Share2,
            title: "Social Sites",
            description: "Manage the company's social media links.",
            href: "/manage/root/site/socials",
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
                            <FeatureListItem key={index} {...feature} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

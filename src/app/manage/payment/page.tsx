
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, History, Gem, CreditCard, ChevronRight, Ban } from "lucide-react";
import Link from "next/link";
import React from "react";
import { checkPermissions } from "@/lib/user-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const FeatureListItem = ({
    icon: Icon,
    title,
    description,
    href,
    isExternal = false,
}: {
    icon: React.ElementType,
    title: string,
    description: string,
    href: string,
    isExternal?: boolean
}) => (
    <Link 
        href={href} 
        className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50"
        target={isExternal ? "_blank" : "_self"}
        rel={isExternal ? "noopener noreferrer" : ""}
    >
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);


export default async function PaymentSubscriptionPage() {
    const [canViewMethods, canViewHistory, canViewSubscriptions, canViewNeupPro] = await Promise.all([
        checkPermissions(['payment.method.show']),
        checkPermissions(['payment.transactions.show']),
        checkPermissions(['payment.subscriptions.show']),
        checkPermissions(['payment.purchase_neup_pro.view']),
    ]);

    const features = [
        {
            icon: CreditCard,
            title: "Payment Methods",
            description: "Manage your saved payment methods.",
            href: "https://neupgroup.com/wallet/methods",
            isExternal: true,
            show: canViewMethods,
        },
        {
            icon: History,
            title: "Transactions History",
            description: "View your past purchases and transactions.",
            href: "https://neupgroup.com/wallet/history?source=neup",
            isExternal: true,
            show: canViewHistory,
        },
        {
            icon: Wallet,
            title: "Subscriptions",
            description: "Manage your active subscriptions with Neup and third-parties.",
            href: "https://neupgroup.com/wallet/subscriptions",
            isExternal: true,
            show: canViewSubscriptions,
        },
        {
            icon: Gem,
            title: "Purchase Neup.Pro",
            description: "Upgrade your account to access premium features.",
            href: "/manage/payment/neup.pro",
            show: canViewNeupPro,
        },
    ];

    const visibleFeatures = features.filter(f => f.show);

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Payment & Subscription</h1>
                <p className="text-muted-foreground">
                    Manage your billing information, subscriptions, and view purchase history.
                </p>
            </div>
             <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Your Wallet</h2>
                <p className="text-muted-foreground text-sm">
                    Review your payment settings and upgrade your plan.
                </p>
                <Card>
                    <CardContent className="divide-y p-2">
                        {visibleFeatures.length > 0 ? (
                            visibleFeatures.map((feature, index) => (
                                <FeatureListItem key={index} {...feature} />
                            ))
                        ) : (
                             <div className="p-4 text-center text-sm text-muted-foreground">
                                You do not have permission to view payment and subscription settings.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}



import { Card, CardContent } from "@/components/ui/card";
import { Wallet, ShieldCheck, UserCheck, FileText, ChevronRight, Ban } from "lucide-react";
import Link from "next/link";
import React from "react";
import { checkPermissions } from "@/lib/user-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
    <Link 
        href={href} 
        className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50"
    >
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);


export default async function RequestsManagementPage() {
    const canView = await checkPermissions(['root.requests.view']);

    if (!canView) {
        return (
            <Alert variant="destructive">
                <Ban className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to view this page.
                </AlertDescription>
            </Alert>
        );
    }

    const features = [
        {
            icon: UserCheck,
            title: "NeupID Approvals",
            description: "Approve or deny requests for new NeupIDs from existing users.",
            href: "/manage/root/requests/neupid",
        },
        {
            icon: ShieldCheck,
            title: "KYC Approval",
            description: "Review and process pending KYC document submissions.",
            href: "/manage/root/requests/kyc",
        },
        {
            icon: Wallet,
            title: "Payment Verification",
            description: "Verify manual payments made for services like Neup.Pro.",
            href: "/manage/root/requests/payment",
        },
         {
            icon: FileText,
            title: "Report Management",
            description: "Address reports filed by users against other users.",
            href: "/manage/root/requests/report",
        },
    ];

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Requests Management</h1>
                <p className="text-muted-foreground">
                    Review and act on pending requests, verifications, and reports.
                </p>
            </div>
            
            <div className="space-y-2">
                 <Card>
                    <CardContent className="divide-y p-2">
                        {features.map((feature, index) => (
                            <FeatureListItem key={index} {...feature} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

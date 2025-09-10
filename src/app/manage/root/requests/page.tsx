

import { Card, CardContent } from "@/components/ui/card";
import { Wallet, ShieldCheck, UserCheck, FileText, Ban, Trash2 } from "@/components/icons";
import React from "react";
import { checkPermissions } from "@/lib/user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListItem } from "@/components/ui/list-item";
import { UserCircle } from "lucide-react";

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
            icon: UserCircle,
            title: "Display Name Requests",
            description: "Review and approve custom display names requested by users.",
            href: "/manage/root/requests/display-name",
        },
        {
            icon: ShieldCheck,
            title: "KYC Approval",
            description: "Review and process pending KYC document submissions.",
            href: "/manage/root/requests/kyc",
        },
        {
            icon: ShieldCheck,
            title: "Verification Requests",
            description: "Review and process user verification requests.",
            href: "/manage/root/requests/verifications",
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
        {
            icon: Trash2,
            title: "Deletion Requests",
            description: "Manage and process account deletion requests.",
            href: "/manage/root/requests/deletion",
        }
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
                            <ListItem key={index} {...feature} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

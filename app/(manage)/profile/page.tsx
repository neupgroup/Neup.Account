
import { Card, CardContent } from "@/components/ui/card";
import React from "react";
import { checkPermissions } from "@/lib/user";
import { notFound } from "next/navigation";
import { ListItem } from "@/components/ui/list-item";
import { PrimaryHeader } from "@/components/ui/primary-header";
import { UserCircle, FileText, HeartHandshake, AtSign, Contact, ShieldCheck } from "@/components/icons";

export default async function ProfilePage() {
    const canViewProfile = await checkPermissions(['profile.view']);

    if (!canViewProfile) {
        notFound();
    }

    const profileFeatures = [
        {
            icon: UserCircle,
            title: "Display Information",
            description: "Update your public display name and photo.",
            href: "/profile/display",
        },
        {
            icon: FileText,
            title: "Legal Name",
            description: "Manage your legal first, middle, and last name.",
            href: "/profile/name",
        },
        {
            icon: HeartHandshake,
            title: "Demographics",
            description: "Update your date of birth and gender.",
            href: "/profile/demographics",
        },
        {
            icon: AtSign,
            title: "NeupID",
            description: "Manage your unique NeupIDs.",
            href: "/profile/neupid",
        },
        {
            icon: Contact,
            title: "Contact Information",
            description: "Manage your phone numbers and addresses.",
            href: "/profile/contact",
        },
        {
            icon: ShieldCheck,
            title: "KYC & Verification",
            description: "Submit documents to verify your identity.",
            href: "/profile/documents",
        },
    ];


    return (
        <div className="grid gap-8">
            <PrimaryHeader
                title="Personal Information"
                description="Manage your personal details, contact info, and identity verification."
            />
            
            <Card>
                <CardContent className="divide-y p-0">
                    {profileFeatures.map((feature, index) => (
                        <ListItem key={index} {...feature} />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

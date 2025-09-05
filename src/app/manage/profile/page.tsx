
import { Card, CardContent } from "@/components/ui/card";
import { User, ShieldCheck, Heart, AtSign, Phone, FileText } from "lucide-react";
import React from "react";
import { checkPermissions } from "@/lib/user";
import { notFound } from "next/navigation";
import { ListItem } from "@/components/ui/list-item";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function ProfilePage() {
    const canViewProfile = await checkPermissions(['profile.view']);

    if (!canViewProfile) {
        notFound();
    }

    const profileFeatures = [
        {
            iconName: "UserCircle",
            title: "Display Information",
            description: "Update your public display name and photo.",
            href: "/manage/profile/display",
        },
        {
            iconName: "FileText",
            title: "Legal Name",
            description: "Manage your legal first, middle, and last name.",
            href: "/manage/profile/name",
        },
        {
            iconName: "HeartHandshake",
            title: "Demographics",
            description: "Update your date of birth and gender.",
            href: "/manage/profile/demographics",
        },
        {
            iconName: "AtSign",
            title: "NeupID",
            description: "Manage your unique NeupIDs.",
            href: "/manage/profile/neupid",
        },
        {
            iconName: "Contact",
            title: "Contact Information",
            description: "Manage your phone numbers and addresses.",
            href: "/manage/profile/contact",
        },
        {
            iconName: "ShieldCheck",
            title: "KYC & Verification",
            description: "Submit documents to verify your identity.",
            href: "/manage/profile/documents",
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

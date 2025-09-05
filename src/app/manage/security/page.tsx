import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ListItem } from "@/components/ui/list-item";
import { SecondaryHeader } from "@/components/ui/secondary-header";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function SecurityPage() {

    const signInMethods = [
        {
            icon: "KeyRound", // Changed from component to string
            title: "Password",
            description: "Change your password regularly to keep your account secure.",
            href: "/manage/security/password",
        },
        {
            icon: "ShieldCheck", // Changed from component to string
            title: "Authenticator App",
            description: "Use an app for an extra layer of security (2FA).",
            href: "/manage/security/totp",
        },
    ];
    
     const recoveryMethods = [
        {
            icon: "FileLock2", // Changed from component to string
            title: "Backup Codes",
            description: "Save codes to use if you lose access to your other recovery methods.",
            href: "/manage/security/backup",
        },
        {
            icon: "Users", // Changed from component to string
            title: "Recovery Account",
            description: "Designate accounts that can help you recover yours.",
            href: "/manage/security/account",
        },
        {
            icon: "Smartphone", // Changed from component to string
            title: "Recovery Phone",
            description: "Add or update your recovery phone number.",
            href: "/manage/security/phone",
        },
        {
            icon: "Mail", // Changed from component to string
            title: "Recovery Email",
            description: "Add or update your recovery email address.",
            href: "/manage/security/email",
        },
    ];
    
     const securityChecks = [
        {
            icon: "Laptop", // Changed from component to string
            title: "Your Devices",
            description: "See where you're signed in.",
            href: "/manage/security/devices",
        },
        {
            icon: "Globe", // Changed from component to string
            title: "Third-Party Apps",
            description: "Manage apps that have access to your account data.",
            href: "/manage/data",
        },
    ];

    return (
        <div className="grid gap-8">
            <PrimaryHeader
                title="Password & Security"
                description="Manage your account's security settings, review activity, and keep your account safe."
            />

            <div className="grid gap-4">
                <SecondaryHeader
                    title="Sign-In Methods"
                    description="Manage your passwords and two-factor authentication."
                />
                <Card>
                    <CardContent className="divide-y p-2">
                        {signInMethods.map((item, index) => (
                           <ListItem key={index} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-4">
                 <SecondaryHeader
                    title="Recovery Methods"
                    description="Set up ways to recover your account if you get locked out."
                />
                <Card>
                    <CardContent className="divide-y p-2">
                        {recoveryMethods.map((item, index) => (
                           <ListItem key={index} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4">
                <SecondaryHeader
                    title="Security Checks"
                    description="Review security issues by running checks across apps, devices, and emails sent."
                />
                 <Card>
                    <CardContent className="divide-y p-2">
                        {securityChecks.map((item, index) => (
                           <ListItem key={index} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
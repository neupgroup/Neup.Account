
import Link from "next/link";
import React from "react";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    KeyRound,
    Smartphone,
    Mail,
    ShieldCheck,
    Laptop,
    History,
    Globe,
    ChevronRight,
    Users,
    FileLock2
} from "lucide-react";

const SecurityListItem = ({
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
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);

export default async function SecurityPage() {

    const signInMethods = [
        {
            icon: KeyRound,
            title: "Password",
            description: "Change your password regularly to keep your account secure.",
            href: "/manage/security/password",
        },
        {
            icon: ShieldCheck,
            title: "Authenticator App",
            description: "Use an app for an extra layer of security (2FA).",
            href: "/manage/security/totp",
        },
    ];
    
     const recoveryMethods = [
        {
            icon: FileLock2,
            title: "Backup Codes",
            description: "Save codes to use if you lose access to your phone.",
            href: "/manage/security/backup",
        },
        {
            icon: Users,
            title: "Recovery Account",
            description: "Designate accounts that can help you recover yours.",
            href: "/manage/security/account",
        },
        {
            icon: Smartphone,
            title: "Recovery Phone",
            description: "Add or update your recovery phone number.",
            href: "/manage/security/phone",
        },
        {
            icon: Mail,
            title: "Recovery Email",
            description: "Add or update your recovery email address.",
            href: "/manage/security/email",
        },
    ];
    
     const securityChecks = [
        {
            icon: Laptop,
            title: "Your Devices",
            description: "See where you're signed in.",
            href: "/manage/security/devices",
        },
        {
            icon: Globe,
            title: "Third-Party Apps",
            description: "Manage apps that have access to your account data.",
            href: "#",
        },
    ];


    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Password & Security</h1>
                <p className="text-muted-foreground">
                    Manage your account's security settings, review activity, and keep your account safe.
                </p>
            </div>

            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Sign-In Methods</h2>
                <p className="text-muted-foreground text-sm">Manage your passwords and two-factor authentication.</p>
                <Card>
                    <CardContent className="divide-y p-2">
                        {signInMethods.map((item, index) => (
                           <SecurityListItem key={index} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Recovery Methods</h2>
                <p className="text-muted-foreground text-sm">Set up ways to recover your account if you get locked out.</p>
                <Card>
                    <CardContent className="divide-y p-2">
                        {recoveryMethods.map((item, index) => (
                           <SecurityListItem key={index} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Security Checks</h2>
                <p className="text-muted-foreground text-sm">Review security issues by running checks across apps, devices, and emails sent.</p>
                 <Card>
                    <CardContent className="divide-y p-2">
                        {securityChecks.map((item, index) => (
                           <SecurityListItem key={index} {...item} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

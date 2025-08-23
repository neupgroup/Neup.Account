
"use client";

import { getUserDashboardStats, impersonateUser, type UserDetails } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { MapPin, Clock, History, Send, ShieldCheck, ChevronRight, LogIn, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import React, { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";


const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) => (
    <div className="flex flex-col items-center text-center gap-1 p-4">
        <Icon className="h-6 w-6 text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
    </div>
);

const ActionItem = ({ icon: Icon, title, description, href }: { icon: React.ElementType, title: string, description: string, href: string }) => (
    <Link href={href} className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50">
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);

function ImpersonateUserForm({ userId, neupId }: { userId: string, neupId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleSwitch = () => {
        startTransition(async () => {
            const result = await impersonateUser(userId, neupId);
            if (result.success) {
                toast({ title: "Success", description: `Switching to @${neupId}'s account.`, className: "bg-accent text-accent-foreground" });
                window.location.href = '/manage/home';
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };
    return (
         <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><LogIn /> Impersonate Account</h2>
            <p className="text-muted-foreground text-sm">Temporarily sign in as this user to troubleshoot or view their experience.</p>
            <Card>
                <CardContent className="pt-6 space-y-4">
                     <div className="p-4 rounded-md border text-sm text-muted-foreground">
                        <p>
                            Impersonate should only be used for debugging purposes and only for investigation purposes only when we get request from the authorized party. Every log is recorded of what you do in the impersonate session, and belongs to you and not to the impersonated user.
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="secondary" disabled={isPending}>Switch to User</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                You are about to sign in as <span className="font-bold">@{neupId}</span>. Your actions may be logged as this user. You will be able to switch back from the user dropdown menu.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSwitch}>Confirm Switch</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}

export function UserDetailsClient({ initialUserDetails }: { initialUserDetails: UserDetails }) {
    const [stats, setStats] = useState({ lastIpAddress: 'N/A', lastLocation: 'N/A', lastActive: 'N/A' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const userStats = await getUserDashboardStats(initialUserDetails.accountId);
            setStats(userStats);
            setLoading(false);
        }
        loadData();
    }, [initialUserDetails.accountId]);

    if (!initialUserDetails) {
        return <p>User not found.</p>;
    }
    
    const actionLinks = [
        { href: `/manage/root/users/${initialUserDetails.neupId}/notice`, icon: Send, title: "Send Notice & Actions", description: "Send warnings or apply administrative blocks to this account." },
        { href: `/manage/root/users/${initialUserDetails.neupId}/notice/history`, icon: History, title: "Notice History", description: "View all past notices sent to this account." },
        { href: `/manage/root/users/${initialUserDetails.neupId}/permissions`, icon: ShieldCheck, title: "Account Permissions", description: "View and manage the permission sets for this account." },
        { href: `/manage/root/users/${initialUserDetails.neupId}/activity`, icon: History, title: "Account Activity", description: "Review a log of all activities performed by this account." },
    ];

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/users" />
            
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                     <Avatar className="h-20 w-20">
                        <AvatarImage src={initialUserDetails.profile.displayPhoto} alt={initialUserDetails.profile.displayName} data-ai-hint="person" />
                        <AvatarFallback>{initialUserDetails.profile.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl font-bold tracking-tight">{initialUserDetails.profile.displayName}</h1>
                        <p className="text-muted-foreground font-mono">@{initialUserDetails.neupId}</p>
                        <p className="text-xs text-muted-foreground">Account ID: {initialUserDetails.accountId}</p>
                    </div>
                     <div className="border-l h-20 mx-4 hidden md:block" />
                     <div className="w-full md:w-auto border-t md:border-0 pt-4 md:pt-0" />
                     <div className="grid grid-cols-3 divide-x w-full md:w-auto">
                        {loading ? (
                            <>
                                <div className="p-4 space-y-1 flex flex-col items-center"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-20" /></div>
                                <div className="p-4 space-y-1 flex flex-col items-center"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-20" /></div>
                                <div className="p-4 space-y-1 flex flex-col items-center"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-20" /></div>
                            </>
                        ) : (
                            <>
                                <InfoItem icon={MapPin} label="Last Location" value={stats.lastLocation} />
                                <InfoItem icon={MapPin} label="Last IP" value={stats.lastIpAddress} />
                                <InfoItem icon={Clock} label="Last Active" value={stats.lastActive} />
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Management Actions</h2>
                <Card>
                    <CardContent className="divide-y p-2">
                        {actionLinks.map(link => (
                            <ActionItem key={link.href} {...link} />
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-2">
                <ImpersonateUserForm userId={initialUserDetails.accountId} neupId={initialUserDetails.neupId} />
            </div>
        </div>
    )
}

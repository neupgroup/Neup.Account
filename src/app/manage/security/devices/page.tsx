
'use client';

import {
    Card,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { getUserSessions } from "@/actions/security/sessions";
import { SessionManager } from "@/app/manage/security/session-manager";
import { getActiveSession } from "@/lib/auth-actions";
import { BackButton } from "@/components/ui/back-button";
import { checkPermissions } from "@/lib/user";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Ban } from "lucide-react";
import { useState, useEffect } from "react";
import type { UserSession } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

function DevicesPageSkeleton() {
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/security" />
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-7 w-1/3" />
                <Skeleton className="h-5 w-1/2" />
                <Card>
                    <div className="border rounded-lg p-4 space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default function DevicesPage() {
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            const hasPermission = await checkPermissions(['security.login_devices.view']);
            setPermissionState(hasPermission ? 'granted' : 'denied');

            if (hasPermission) {
                const [sessionData, currentSessionData] = await Promise.all([
                    getUserSessions(),
                    getActiveSession()
                ]);
                setSessions(sessionData);
                setCurrentSessionId(currentSessionData?.sessionId || null);
            }
        }
        fetchData();
    }, []);

    if (permissionState === 'loading') {
        return <DevicesPageSkeleton />;
    }

    if (permissionState === 'denied') {
        return (
             <div className="grid gap-8">
                <BackButton href="/manage/security" />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view login devices.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/security" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Your Devices</h1>
                <p className="text-muted-foreground">
                    A list of devices that have been used to sign in to your account.
                </p>
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Session Management</h2>
                <p className="text-muted-foreground text-sm">
                    You can sign out any session you don't recognize.
                </p>
                <Card>
                    <SessionManager 
                        initialSessions={sessions} 
                        currentSessionId={currentSessionId} 
                    />
                </Card>
            </div>
        </div>
    )
}

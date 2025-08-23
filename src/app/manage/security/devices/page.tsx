

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { getUserSessions } from "../actions";
import { SessionManager } from "../session-manager";
import { getActiveSessionDetails } from "@/lib/auth-actions";
import { BackButton } from "@/components/ui/back-button";
import { checkPermissions } from "@/lib/user-actions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Ban } from "lucide-react";

export default async function DevicesPage() {
    const canView = await checkPermissions(['security.login_devices.view']);

    if (!canView) {
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

    const [sessions, currentSession] = await Promise.all([
        getUserSessions(),
        getActiveSessionDetails()
    ]);

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
                        currentSessionId={currentSession?.auth_session_id || null} 
                    />
                </Card>
            </div>
        </div>
    )
}

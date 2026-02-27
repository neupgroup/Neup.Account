'use client';

import { useParams } from "next/navigation";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button";
import { ActivityList } from "./activity-list";

export default function UserActivityPage() {
    const params = useParams<{ id: string }>();
    
    return (
         <div className="grid gap-8">
            <BackButton href={`/manage/${params.id}`} />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Account Activity</h1>
                <p className="text-muted-foreground">
                    Recent activity log for account ID: {params.id}.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Last known activities for this user account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ActivityList accountId={params.id} />
                </CardContent>
            </Card>
        </div>
    )
}

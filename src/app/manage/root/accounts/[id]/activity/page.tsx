

import { notFound } from "next/navigation";
import { getActivity, getUserDetails } from "@/actions/root/users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin } from "lucide-react";


export default async function UserActivityPage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
    if (!userDetails) {
        notFound();
    }

    const activity = await getActivity(params.id);
    
    return (
         <div className="grid gap-8">
            <BackButton href={`/manage/root/accounts/${params.id}`} />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Account Activity</h1>
                <p className="text-muted-foreground">
                    Recent activity log for @{userDetails.neupId}.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Last known activities for this user account.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>IP & Location</TableHead>
                                <TableHead>Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activity.map(log => (
                                <TableRow key={log.id}>
                                    <TableCell>{log.action}</TableCell>
                                    <TableCell><Badge variant={log.status === 'Success' ? 'default' : 'destructive'}>{log.status}</Badge></TableCell>
                                    <TableCell>
                                        <div className="font-mono text-xs">{log.ip}</div>
                                        {log.geolocation && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                <span>{log.geolocation}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>{log.timestamp}</TableCell>
                                </TableRow>
                            ))}
                            {activity.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No recent activity.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
    )
}

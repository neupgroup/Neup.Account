
import Link from "next/link"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPendingNeupIdRequests } from "@/services/manage/requests/neupid"
import { checkPermissions } from "@/core/helpers/user"
import { notFound } from "next/navigation"
import { BackButton } from "@/components/ui/back-button"

export default async function NeupidApprovalsPage() {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) {
        notFound();
    }
    
    const neupidRequests = await getPendingNeupIdRequests();

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">NeupID Requests</h1>
                <p className="text-muted-foreground">
                    Approve or deny requests for new NeupIDs from existing users.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Pending NeupID Requests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                        <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Requested NeupID</TableHead>
                                <TableHead>Request Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Current NeupIDs</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {neupidRequests.length > 0 ? (
                                neupidRequests.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            <Link href={`/manage/requests/${item.id}`} className="font-medium text-primary hover:underline">
                                                {item.userFullName}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{item.requestedNeupId}</TableCell>
                                        <TableCell>{item.requestDate}</TableCell>
                                        <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                                        <TableCell>{item.currentNeupIds.join(', ')}</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">No pending NeupID requests.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-4">
                    <Button variant="outline">See More</Button>
                </CardFooter>
            </Card>
        </div>
    )
}

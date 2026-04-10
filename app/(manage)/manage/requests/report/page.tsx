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
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { checkPermissions } from '@/core/helpers/user'
import { notFound } from "next/navigation"
import { BackButton } from "@/components/ui/back-button"

// Mock data for User Reportings
const userReportings = [
    { id: 'rep1', reportedUser: 'Ivan Garcia', reporter: 'Jack Taylor', reason: 'Spamming', reported: '2023-10-26', status: 'Pending', reporterIp: '203.0.113.11' },
    { id: 'rep2', reportedUser: 'Bob Williams', reporter: 'Admin', reason: 'Suspicious Activity', reported: '2023-10-23', status: 'Under Review', reporterIp: '198.51.100.2' },
];

export default async function ReportManagementPage() {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) {
        notFound();
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Report Management</h1>
                <p className="text-muted-foreground">
                    Address reports filed by users against other users.
                </p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Pending User Reports</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Reported User</TableHead>
                                <TableHead>Reporter</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Report Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Content/Link</TableHead>
                                <TableHead>Reviewed By</TableHead>
                                <TableHead>Review Date</TableHead>
                                <TableHead>IP Address (Reporter)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userReportings.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        <Button variant="link" className="p-0 h-auto font-medium">{item.reportedUser}</Button>
                                    </TableCell>
                                    <TableCell>{item.reporter}</TableCell>
                                    <TableCell>{item.reason}</TableCell>
                                    <TableCell>{item.reported}</TableCell>
                                    <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                                    <TableCell><Button variant="link" className="p-0 h-auto">View</Button></TableCell>
                                    <TableCell>N/A</TableCell>
                                    <TableCell>N/A</TableCell>
                                    <TableCell>{item.reporterIp}</TableCell>
                                </TableRow>
                            ))}
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

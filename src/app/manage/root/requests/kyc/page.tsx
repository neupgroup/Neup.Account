

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
import { checkPermissions } from "@/lib/user-actions"
import { notFound } from "next/navigation"
import { BackButton } from "@/components/ui/back-button"

// Mock data for KYC Verifications
const kycVerifications = [
    { id: 'kyc1', user: 'Eve Davis', docType: 'Passport', submitted: '2023-10-26', status: 'Pending', country: 'USA', ip: '198.51.100.1' },
    { id: 'kyc2', user: 'Frank Miller', docType: "Driver's License", submitted: '2023-10-25', status: 'Pending', country: 'Canada', ip: '203.0.113.5' },
];

export default async function KycApprovalPage() {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) {
        notFound();
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
                <p className="text-muted-foreground">
                    Review and process pending KYC document submissions.
                </p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Pending KYC Verifications</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Document Type</TableHead>
                                <TableHead>Document ID</TableHead>
                                <TableHead>Submission Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Reviewed By</TableHead>
                                <TableHead>Review Date</TableHead>
                                <TableHead>Country</TableHead>
                                <TableHead>IP Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {kycVerifications.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        <Button variant="link" className="p-0 h-auto font-medium">{item.user}</Button>
                                    </TableCell>
                                    <TableCell>{item.docType}</TableCell>
                                    <TableCell>...-1234</TableCell>
                                    <TableCell>{item.submitted}</TableCell>
                                    <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                                    <TableCell>N/A</TableCell>
                                    <TableCell>N/A</TableCell>
                                    <TableCell>{item.country}</TableCell>
                                    <TableCell>{item.ip}</TableCell>
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

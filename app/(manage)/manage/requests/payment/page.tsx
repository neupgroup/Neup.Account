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
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { checkPermissions } from "@/core/helpers/user"
import { notFound } from "next/navigation"
import { BackButton } from "@/components/ui/back-button"


export default async function PaymentVerificationPage() {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) {
        notFound();
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/requests" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Payment Verification</h1>
                <p className="text-muted-foreground">
                    Verify manual payments for services.
                </p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Pending Payments</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-muted-foreground">
                   <p>This feature is coming soon.</p>
                </CardContent>
            </Card>
        </div>
    )
}

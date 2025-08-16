

import { notFound } from "next/navigation";
import { getUserDetails } from "../../actions";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function NoticeHistoryPage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
    if (!userDetails) {
        notFound();
    }
    
    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/root/users/${params.id}`} />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Notice History</h1>
                <p className="text-muted-foreground">
                    A log of all warnings and notices sent to @{params.id}.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground">
                        This section will display a table of all historical notices.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

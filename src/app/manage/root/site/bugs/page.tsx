
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";

export default function ReportedBugsPage() {
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Reported Bugs</h1>
                <p className="text-muted-foreground">
                    Review bugs and other issues reported by users.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                    <CardDescription>
                        This feature is currently under development.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>A list of user-reported bugs and issues will be available here.</p>
                </CardContent>
            </Card>
        </div>
    );
}

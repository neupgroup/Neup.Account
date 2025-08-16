
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";

export default function ViewAppPage({ params }: { params: { slugid: string } }) {

  return (
    <div className="grid gap-6">
      <BackButton href="/manage/root/app" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          View Application
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
            ID: {params.slugid}
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>Details about this application will be shown here.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
            <p>The ability to view app details and associated data will be available here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}

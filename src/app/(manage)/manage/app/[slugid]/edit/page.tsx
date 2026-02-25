
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";

export default async function EditAppPage({ params }: { params: Promise<{ slugid: string }> }) {
  const { slugid } = await params;

  return (
    <div className="grid gap-6">
      <BackButton href={`/manage/app/${slugid}`} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Edit Application
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
            ID: {slugid}
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>A form to edit this application will be available here.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
            <p>The ability to edit application details will be available here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}

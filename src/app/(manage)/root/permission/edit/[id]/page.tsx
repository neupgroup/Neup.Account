
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";

export default async function EditPermissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="grid gap-6">
      <BackButton href="/manage/root/permission" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Manage Permission Set
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
            ID: {id}
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>A form to view, edit, and report on this permission set will be available here.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
            <p>The ability to manage this permission set will be available here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}

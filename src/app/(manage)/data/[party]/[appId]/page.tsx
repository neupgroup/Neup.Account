import { notFound } from 'next/navigation';
import { getApplicationDetails } from '@/actions/data/applications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ShieldQuestion, Trash2 } from '@/components/icons';
import { BackButton } from '@/components/ui/back-button';

export default async function AppDataAccessPage({ params }: { params: Promise<{ appId: string, party: string }> }) {
    const { appId, party } = await params;
    const app = await getApplicationDetails(appId);

    if (!app || (party !== '1' && party !== '3')) {
        notFound();
    }
    
    const partyName = app.party === 'first' ? 'First-Party App' : 'Third-Party App';

    return (
        <div className="grid gap-6">
            <BackButton href="/manage/data" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
                <p className="text-muted-foreground">
                    Review what data you share with this application.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{app.name}</CardTitle>
                    <CardDescription>{app.description}</CardDescription>
                    <div className="pt-2">
                         <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground rounded-md bg-muted px-2 py-1">
                            <ShieldQuestion className="h-4 w-4" /> {partyName}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h3 className="font-semibold mb-2">Data Accessed from NeupID</h3>
                        <div className="space-y-2 rounded-md border p-4">
                            {app.dataAccessed?.map((dataPoint, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-primary" />
                                    <span className="text-sm">{dataPoint}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                    <h3 className="font-semibold">Manage Access</h3>
                     <p className="text-sm text-muted-foreground -mt-2">
                        Revoking access will prevent this app from accessing your NeupID data in the future. You may need to re-authorize it to use the service again.
                    </p>
                    <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Revoke Access
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
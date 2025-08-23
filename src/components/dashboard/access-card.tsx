
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getConnectedApplications } from '@/app/manage/data/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AppWindow, ChevronRight } from 'lucide-react';


export async function AccessCard() {
    const { firstParty, thirdParty } = await getConnectedApplications();
    const totalApps = firstParty.length + thirdParty.length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Access & Sharing</CardTitle>
                <CardDescription>
                    You've granted {totalApps} app{totalApps === 1 ? '' : 's'} access to your data.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    {firstParty.slice(0, 2).map((app) => (
                        <div key={app.id} className="flex items-center">
                            <AppWindow className="h-5 w-5 mr-3 text-muted-foreground" />
                            <span className="text-sm font-medium flex-grow">{app.name}</span>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/manage/data/1/${app.id}`}>Manage</Link>
                            </Button>
                        </div>
                    ))}
                    {thirdParty.slice(0, 1).map((app) => (
                         <div key={app.id} className="flex items-center">
                            <AppWindow className="h-5 w-5 mr-3 text-muted-foreground" />
                            <span className="text-sm font-medium flex-grow">{app.name}</span>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/manage/data/3/${app.id}`}>Manage</Link>
                            </Button>
                        </div>
                    ))}
                 </div>
                 <Button variant="outline" className="w-full" asChild>
                    <Link href="/manage/data">View All Apps <ChevronRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardContent>
        </Card>
    );
}


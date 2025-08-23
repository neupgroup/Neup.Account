
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserSessions } from '@/app/manage/security/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Laptop, ChevronRight } from 'lucide-react';


export async function SecurityCard() {
    const sessions = await getUserSessions();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Security & Sessions</CardTitle>
                <CardDescription>
                    {sessions.length} active device{sessions.length === 1 ? '' : 's'}. Trust only the devices you recognize.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    {sessions.slice(0, 3).map((session) => (
                        <div key={session.id} className="flex items-center">
                            <Laptop className="h-5 w-5 mr-3 text-muted-foreground" />
                            <span className="text-sm font-medium flex-grow truncate">{session.userAgent}</span>
                            <span className="text-xs text-muted-foreground">{session.lastLoggedIn}</span>
                        </div>
                    ))}
                 </div>
                 <Button variant="outline" className="w-full" asChild>
                    <Link href="/manage/security/devices">Manage All Devices <ChevronRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardContent>
        </Card>
    );
}


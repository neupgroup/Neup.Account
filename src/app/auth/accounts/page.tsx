import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getValidatedStoredAccounts } from '@/lib/session';
import { AccountList } from './account-list';
import { ChevronRight } from '@/components/icons';


export default async function AccountsPage() {
    const storedAccounts = await getValidatedStoredAccounts();

    return (
        <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
            <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
                <CardHeader>
                    <div className="flex justify-start items-center mb-4">
                        
                    </div>
                    <CardTitle className="text-2xl font-headline">Choose an account</CardTitle>
                    <CardDescription>
                       Continue to NeupID Group Products and Services
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <AccountList accounts={storedAccounts} mode="switch" />
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-2 p-4 border-t">
                    <Link
                      href="/auth/start"
                      className="flex w-full items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold">Use other Neup Account</h3>
                        <p className="text-sm text-muted-foreground">Sign Up or Sign In for a Neup Account.</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}

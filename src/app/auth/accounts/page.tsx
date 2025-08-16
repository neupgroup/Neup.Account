
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getValidatedStoredAccounts } from '@/lib/auth-actions';
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
                    <AccountList accounts={storedAccounts} />
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-4 p-4 border-t">
                    <Link
                      href="/auth/signin"
                      className="flex w-full items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold">Use another account</h3>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="flex w-full items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold">Create account</h3>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}

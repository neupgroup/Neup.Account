import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestHomePage() {
  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Utilities</CardTitle>
          <CardDescription>
            Use these pages to set up your development environment and test application functionality.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
            <Link href="/test/permission/create" className="block">
                <Card className="h-full hover:border-primary">
                    <CardHeader>
                        <CardTitle className="text-lg">Permission Setup</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Populate the Firestore database with the required permission sets for admins and standard users.
                        </p>
                    </CardContent>
                </Card>
            </Link>
            <Link href="/test/account/create" className="block">
                 <Card className="h-full hover:border-primary">
                    <CardHeader>
                        <CardTitle className="text-lg">Account Creation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Quickly create new admin or standard user accounts for testing purposes.
                        </p>
                    </CardContent>
                </Card>
            </Link>
        </CardContent>
      </Card>
    </div>
  );
}

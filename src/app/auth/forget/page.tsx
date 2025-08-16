import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgetPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-card md:bg-background md:items-center">
      <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
        <CardHeader>
          <div className="flex justify-start items-center mb-4">
            
          </div>
          <CardTitle className="text-2xl font-headline">Forgot NeupID?</CardTitle>
          <CardDescription>
            Enter the email address associated with your account and we'll send you a link to recover your NeupID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Send Recovery Link
            </Button>
          </form>
           <div className="mt-4 text-center text-sm">
            Remembered your NeupID?{" "}
            <Link href="/auth/signin" className="underline text-primary">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

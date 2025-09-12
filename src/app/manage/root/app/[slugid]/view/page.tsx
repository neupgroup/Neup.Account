'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { getAppDetails, regenerateAppSecret } from '../../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyRound, RefreshCw, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Application } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function AppDetailsSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    )
}

export default function ViewAppPage({ params: paramsProp }: { params: { slugid: string } }) {
    const params = React.use(paramsProp);
    const [app, setApp] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchDetails = async () => {
            const data = await getAppDetails(params.slugid);
            if (!data) notFound();
            setApp(data);
            setLoading(false);
        };
        fetchDetails();
    }, [params.slugid]);

    const handleRegenerate = () => {
        startTransition(async () => {
            const result = await regenerateAppSecret(params.slugid);
            if (result.success && result.newSecret) {
                setNewSecret(result.newSecret);
                setShowSecret(true); // Show the new secret immediately
                toast({ title: "New Secret Generated", description: "The old secret is no longer valid." });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    }
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard!" });
    };

    if (loading || !app) {
        return <AppDetailsSkeleton />;
    }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {app.name}
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
            ID: {app.id}
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <CardDescription>{app.description}</CardDescription>
        </CardHeader>
      </Card>

       <Card>
        <CardHeader>
            <CardTitle>App Secret</CardTitle>
            <CardDescription>Manage the secret key used to authenticate with NeupID APIs.</CardDescription>
        </CardHeader>
        <CardContent>
            {newSecret ? (
                 <div className="space-y-4">
                    <Alert variant="destructive">
                        <KeyRound className="h-4 w-4" />
                        <AlertTitle>New Secret Generated</AlertTitle>
                        <AlertDescription>
                          Please copy this new secret now. You will not be able to see it again.
                        </AlertDescription>
                    </Alert>
                    <div className="relative">
                        <Input
                            type={showSecret ? 'text' : 'password'}
                            readOnly
                            value={newSecret}
                            className="font-mono pr-20"
                        />
                         <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                             <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSecret(!showSecret)}>
                                {showSecret ? <EyeOff /> : <Eye />}
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(newSecret)}>
                                <Copy />
                            </Button>
                         </div>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">The app secret is hidden for security. You can generate or regenerate it if you have lost it.</p>
            )}
        </CardContent>
        <CardFooter>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="secondary" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Generate / Regenerate Secret
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will generate a new app secret. Any existing secret will be immediately invalidated and any applications using it will stop working until you update them. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerate} disabled={isPending}>
                            Yes, Regenerate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}

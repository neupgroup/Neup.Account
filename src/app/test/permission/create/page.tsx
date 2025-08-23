"use client";

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { populatePermissions } from '../actions';

export default function CreatePermissionsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<string[]>([]);

    const handlePopulate = async () => {
        setIsLoading(true);
        setResults([]);
        const result = await populatePermissions();
        if (result.success && result.messages) {
            toast({
                title: 'Success!',
                description: 'Permissions have been populated in the database.',
                className: 'bg-accent text-accent-foreground',
            });
            setResults(result.messages);
        } else {
            toast({
                variant: 'destructive',
                title: 'An error occurred',
                description: result.error,
            });
        }
        setIsLoading(false);
    };

    return (
        <div className="grid gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Populate Permissions</CardTitle>
                    <CardDescription>
                        Click the button below to create the default 'admin' and 'standard_user' permission sets in your Firestore database. This is a one-time setup action.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handlePopulate} disabled={isLoading}>
                        {isLoading ? 'Populating...' : 'Populate Permissions'}
                    </Button>

                    {results.length > 0 && (
                        <div className="mt-4 space-y-2 rounded-md border p-4">
                            <h3 className="font-semibold">Results:</h3>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground">
                                {results.map((message, index) => (
                                    <li key={index}>{message}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

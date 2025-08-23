"use client";

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createTestAccount } from '../actions';

export default function CreateAccountPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [createdAccount, setCreatedAccount] = useState<{ neupId: string; pass: string } | null>(null);
    const [accountType, setAccountType] = useState<'Standard' | 'Root' | null>(null);

    const handleCreate = async (isAdmin: boolean) => {
        setIsLoading(true);
        setCreatedAccount(null);
        setAccountType(isAdmin ? 'Root' : 'Standard');

        const result = await createTestAccount(isAdmin);
        if (result.success && result.account) {
            toast({
                title: 'Account Created!',
                description: `Successfully created ${isAdmin ? 'admin' : 'standard'} account.`,
                className: 'bg-accent text-accent-foreground',
            });
            setCreatedAccount(result.account);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error Creating Account',
                description: result.error,
            });
        }
        setIsLoading(false);
    };

    return (
        <div className="grid gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Create Test Accounts</CardTitle>
                    <CardDescription>
                       Quickly generate test user accounts with pre-defined permission sets.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <Button onClick={() => handleCreate(false)} disabled={isLoading}>
                            {isLoading && accountType === 'Standard' ? 'Creating...' : 'Create Standard Account'}
                        </Button>
                        <Button onClick={() => handleCreate(true)} disabled={isLoading} variant="secondary">
                            {isLoading && accountType === 'Root' ? 'Creating...' : 'Create Root (Admin) Account'}
                        </Button>
                    </div>

                     {createdAccount && (
                        <div className="mt-6 space-y-2 rounded-md border bg-muted/50 p-4">
                            <h3 className="font-semibold">{accountType} Account Created:</h3>
                            <div className="text-sm">
                                <p><strong>NeupID:</strong> <span className="font-mono">{createdAccount.neupId}</span></p>
                                <p><strong>Password:</strong> <span className="font-mono">{createdAccount.pass}</span></p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { useEffect, useState, useTransition, Suspense } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Ban } from "@/components/icons";
import { getAccessableAccount } from '@/services/manage/accounts';
import { checkPermissions } from '@/services/user';
import { getActiveAccountId } from '@/core/auth/verify';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrimaryHeader } from "@/components/ui/primary-header";
import { FlowLink } from '@/components/ui/flow-link';
import { useSearchParams } from 'next/navigation';

function AccountsPageInner() {
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [accountIds, setAccountIds] = useState<string[]>([]);
    const [filter, setFilter] = useState('');
    const [loading, startTransition] = useTransition();
    const searchParams = useSearchParams();

    useEffect(() => {
        const q = searchParams.get('q') || '';
        setFilter(q);
    }, [searchParams]);

    useEffect(() => {
        checkPermissions(['root.account.view']).then((hasPerm) => {
            setPermissionState(hasPerm ? 'granted' : 'denied');
        });
    }, []);

    useEffect(() => {
        if (permissionState !== 'granted') return;
        startTransition(async () => {
            const accountId = await getActiveAccountId();
            if (!accountId) return;
            const ids = await getAccessableAccount(accountId);
            setAccountIds(ids);
        });
    }, [permissionState]);

    const filtered = filter
        ? accountIds.filter((id) => id.toLowerCase().includes(filter.toLowerCase()))
        : accountIds;

    if (permissionState === 'loading') {
        return (
            <div className="grid gap-8">
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
                <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
        );
    }

    if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <PrimaryHeader title="Accounts" description="View and manage all accounts in the system." />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view account management.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
                <p className="text-muted-foreground">
                    {filter
                        ? `Search results for "${filter}"`
                        : `${accountIds.length} accessible account${accountIds.length !== 1 ? 's' : ''}`}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by account ID..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 8 }, (_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filtered.length > 0 ? (
                                filtered.map((id) => (
                                    <TableRow key={id}>
                                        <TableCell>
                                            <FlowLink
                                                href={`/manage/accounts/${id}`}
                                                className="font-mono text-sm hover:underline text-primary"
                                            >
                                                {id}
                                            </FlowLink>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell className="h-24 text-center text-muted-foreground">
                                        No accessible accounts found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AccountsPage() {
    return (
        <Suspense fallback={
            <div className="grid gap-8 p-8">
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-64 w-full" />
            </div>
        }>
            <AccountsPageInner />
        </Suspense>
    );
}

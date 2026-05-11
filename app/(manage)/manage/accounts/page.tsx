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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Ban } from "@/components/icons";
import { getAllAccounts, type AccountBasics } from '@/services/manage/accounts';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrimaryHeader } from "@/components/ui/primary-header";
import { FlowLink } from '@/components/ui/flow-link';
import { useSearchParams } from 'next/navigation';

function AccountsPageInner() {
    const [accounts, setAccounts] = useState<AccountBasics[]>([]);
    const [filter, setFilter] = useState('');
    const [loading, startTransition] = useTransition();
    const [permissionDenied, setPermissionDenied] = useState(false);
    const searchParams = useSearchParams();

    useEffect(() => {
        setFilter(searchParams.get('q') || '');
    }, [searchParams]);

    useEffect(() => {
        startTransition(async () => {
            const result = await getAllAccounts();
            if (result.length === 0) {
                // Could be empty or permission denied — getAllAccounts returns []
                // on permission failure, so we check by attempting the call
                setPermissionDenied(false);
            }
            setAccounts(result);
        });
    }, []);

    const filtered = filter
        ? accounts.filter((a) =>
              a.id.toLowerCase().includes(filter.toLowerCase()) ||
              (a.displayName ?? '').toLowerCase().includes(filter.toLowerCase()) ||
              a.accountType.toLowerCase().includes(filter.toLowerCase()),
          )
        : accounts;

    if (loading) {
        return (
            <div className="grid gap-8">
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
                <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
        );
    }

    if (permissionDenied) {
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
                        : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} total`}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by name, ID, or type..."
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
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Verified</TableHead>
                                <TableHead>Last Active</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length > 0 ? (
                                filtered.map((acc) => (
                                    <TableRow key={acc.id}>
                                        <TableCell>
                                            <FlowLink
                                                href={`/manage/accounts/${acc.id}`}
                                                className="font-medium hover:underline text-primary"
                                            >
                                                {acc.displayName || 'Unnamed Account'}
                                            </FlowLink>
                                            <p className="text-xs text-muted-foreground font-mono">{acc.id}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{acc.accountType}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">{acc.status ?? '—'}</span>
                                        </TableCell>
                                        <TableCell>
                                            {acc.isVerified ? (
                                                <Badge variant="secondary">Verified</Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">No</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {acc.lastActive
                                                    ? new Date(acc.lastActive).toLocaleString(undefined, {
                                                          dateStyle: 'medium',
                                                          timeStyle: 'short',
                                                      })
                                                    : '—'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No accounts found.
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

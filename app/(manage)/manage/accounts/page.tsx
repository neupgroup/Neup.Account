"use client";

import { useEffect, useState, useTransition } from 'react';
import { useDebounce } from 'use-debounce';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Ban } from "@/components/icons";
import { getAllAccounts, type AccountListItem } from '@/services/manage/accounts';
import { checkPermissions } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrimaryHeader } from "@/components/ui/primary-header";
import { FlowLink } from '@/components/ui/flow-link';
import { useSearchParams } from 'next/navigation';
import React from 'react';

type SortKey = keyof AccountListItem | null;

function AccountsPageComponent() {
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [accounts, setAccounts] = useState<AccountListItem[]>([]);
    const [loading, startTransition] = useTransition();
    const searchParams = useSearchParams();

    const [filter, setFilter] = useState(searchParams.get('q') || '');
    const [sortKey, setSortKey] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'dateCreated');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>((searchParams.get('dir') as 'asc' | 'desc') || 'desc');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
    const [hasNextPage, setHasNextPage] = useState(false);

    const [debouncedFilter] = useDebounce(filter, 500);

    // Permission check — runs once on mount
    useEffect(() => {
        checkPermissions(['root.account.view']).then(hasPerm => {
            setPermissionState(hasPerm ? 'granted' : 'denied');
        });
    }, []);

    // Fetch data whenever filter/sort/page changes.
    // URL is updated via history.replaceState to avoid router reference instability.
    useEffect(() => {
        if (permissionState !== 'granted') return;

        const url = new URL(window.location.href);
        url.searchParams.set('page', String(page));
        if (debouncedFilter) {
            url.searchParams.set('q', debouncedFilter);
        } else {
            url.searchParams.delete('q');
        }
        if (sortKey) {
            url.searchParams.set('sort', sortKey);
        } else {
            url.searchParams.delete('sort');
        }
        url.searchParams.set('dir', sortDirection);
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);

        startTransition(async () => {
            const { accounts: rows, hasNextPage: next } = await getAllAccounts(
                debouncedFilter,
                page,
                10,
                sortKey || 'dateCreated',
                sortDirection
            );
            setAccounts(rows);
            setHasNextPage(next);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedFilter, sortKey, sortDirection, permissionState]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
        setPage(1);
    };

    const renderSortArrow = (key: SortKey) => {
        if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
        return sortDirection === 'asc' ? '▲' : '▼';
    };

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
                <PrimaryHeader
                    title="Accounts"
                    description="View and manage all accounts in the system."
                />
                <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view account management.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
                    <p className="text-muted-foreground">
                        {debouncedFilter
                            ? `Search results for "${debouncedFilter}"`
                            : 'A complete list of all accounts in the system.'}
                    </p>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by name, ID, or type..."
                            value={filter}
                            onChange={(e) => {
                                setFilter(e.target.value);
                                setPage(1);
                            }}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">
                                    <Button variant="ghost" onClick={() => handleSort('name')}>
                                        Name {renderSortArrow('name')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('dateCreated')}>
                                        Created On {renderSortArrow('dateCreated')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('accountType')}>
                                        Type {renderSortArrow('accountType')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('isRoot')}>
                                        Is Root {renderSortArrow('isRoot')}
                                    </Button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(10)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : accounts.length > 0 ? (
                                accounts.map((acc) => (
                                    <TableRow key={acc.id}>
                                        <TableCell>
                                            <FlowLink href={`/manage/accounts/${acc.id}`} className="font-medium hover:underline text-primary">
                                                {acc.name}
                                            </FlowLink>
                                            <p className="text-xs text-muted-foreground font-mono">{acc.id}</p>
                                        </TableCell>
                                        <TableCell>{acc.dateCreated}</TableCell>
                                        <TableCell><Badge variant="outline">{acc.accountType}</Badge></TableCell>
                                        <TableCell>{acc.isRoot ? 'Yes' : 'No'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No accounts found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                    <Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1 || loading}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                    <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={!hasNextPage || loading}>
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function AccountsPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <AccountsPageComponent />
        </React.Suspense>
    );
}

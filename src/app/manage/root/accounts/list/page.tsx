
"use client";

import { useEffect, useState, useMemo, useTransition, useCallback } from 'react';
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
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "@/components/icons";
import { getAllAccounts, type AccountListItem } from '@/actions/root/accounts';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

type SortKey = keyof AccountListItem | null;

function AccountsListPageComponent() {
    const [accounts, setAccounts] = useState<AccountListItem[]>([]);
    const [loading, startTransition] = useTransition();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Component state initialized from URL search params
    const [filter, setFilter] = useState(searchParams.get('q') || '');
    const [sortKey, setSortKey] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>((searchParams.get('dir') as 'asc' | 'desc') || 'desc');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
    
    const [hasNextPage, setHasNextPage] = useState(false);
    
    const [debouncedFilter] = useDebounce(filter, 500);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { accounts, hasNextPage: newHasNextPage } = await getAllAccounts(
                debouncedFilter,
                page,
                10, // Page size
                sortKey || 'createdAt',
                sortDirection
            );
            setAccounts(accounts);
            setHasNextPage(newHasNextPage);
        });
    }, [debouncedFilter, page, sortKey, sortDirection]);

    useEffect(() => {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('page', String(page));
        if (debouncedFilter) {
            newUrl.searchParams.set('q', debouncedFilter);
        } else {
            newUrl.searchParams.delete('q');
        }
        if (sortKey) {
            newUrl.searchParams.set('sort', sortKey);
        } else {
            newUrl.searchParams.delete('sort');
        }
        newUrl.searchParams.set('dir', sortDirection);

        // Use router.replace to update the URL without adding to history
        router.replace(newUrl.toString(), { scroll: false });
        fetchData();
    }, [page, debouncedFilter, sortKey, sortDirection, router, fetchData]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
        setPage(1); // Reset to first page on sort change
    };
    
    const renderSortArrow = (key: SortKey) => {
        if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
        return sortDirection === 'asc' ? '▲' : '▼';
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/accounts" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Search for accounts</h1>
                <p className="text-muted-foreground">
                    A look into the accounts on Neup.Accounts.
                </p>
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
                                setPage(1); // Reset to first page on filter change
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
                                     <Button variant="ghost" onClick={() => handleSort('createdAt')}>
                                        Created On {renderSortArrow('createdAt')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('type')}>
                                        Type {renderSortArrow('type')}
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
                                            <Link href={`/manage/root/accounts/${acc.id}`} className="font-medium hover:underline text-primary">
                                                {acc.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground font-mono">{acc.id}</p>
                                        </TableCell>
                                        <TableCell>{acc.createdAt}</TableCell>
                                        <TableCell><Badge variant="outline">{acc.type}</Badge></TableCell>
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

export default function ListAccountsPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <AccountsListPageComponent />
        </React.Suspense>
    )
}

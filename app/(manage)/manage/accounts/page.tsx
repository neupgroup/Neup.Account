"use client";

import { useEffect, useState, useTransition, Suspense } from 'react';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Ban, CheckCircle2, AtSign, Clock } from "@/components/icons";
import { getAllAccounts, type AccountBasics } from '@/services/manage/accounts';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrimaryHeader } from "@/components/ui/primary-header";
import { FlowLink } from '@/components/ui/flow-link';
import { useSearchParams } from 'next/navigation';

function StatusDot({ status }: { status: string | null }) {
    let color = 'bg-gray-400';
    if (status === 'active') color = 'bg-green-500';
    else if (status === 'expired' || status === 'suspended' || status === 'banned') color = 'bg-red-500';
    return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function AccountRow({ acc, isFirst, isLast }: { acc: AccountBasics; isFirst: boolean; isLast: boolean }) {
    const lastActive = acc.lastActive
        ? new Date(acc.lastActive).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          })
        : null;

    const roundingClass = isFirst && isLast
        ? 'rounded-lg'
        : isFirst
        ? 'rounded-t-lg'
        : isLast
        ? 'rounded-b-lg'
        : '';

    return (
        <FlowLink href={`/manage/accounts/${acc.id}`}>
            <div
                className={`
                    flex items-center gap-4 px-4 py-3.5
                    border border-border bg-card
                    hover:bg-accent/40 transition-colors
                    ${roundingClass}
                    ${!isFirst ? '-mt-px' : ''}
                `}
            >
                {/* Avatar / initials */}
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground select-none">
                    {acc.displayName?.charAt(0).toUpperCase() ?? '?'}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <StatusDot status={acc.status} />
                        <span className="font-medium truncate leading-tight">
                            {acc.displayName || 'Unnamed Account'}
                        </span>
                        {acc.isVerified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        {acc.neupId ? (
                            <>
                                <AtSign className="h-3 w-3 shrink-0" />
                                <span className="font-mono truncate">{acc.neupId}</span>
                            </>
                        ) : (
                            <span className="italic">No NeupID</span>
                        )}
                    </div>
                </div>

                {/* Right side: type + last active */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs capitalize">
                        {acc.accountType}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{lastActive ?? 'Never active'}</span>
                    </div>
                </div>
            </div>
        </FlowLink>
    );
}

function AccountListSkeleton() {
    return (
        <div>
            {Array.from({ length: 6 }, (_, i) => (
                <div
                    key={i}
                    className={`
                        flex items-center gap-4 px-4 py-3.5 border border-border bg-card
                        ${i === 0 ? 'rounded-t-lg' : ''}
                        ${i === 5 ? 'rounded-b-lg' : ''}
                        ${i > 0 ? '-mt-px' : ''}
                    `}
                >
                    <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
            ))}
        </div>
    );
}

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
            setPermissionDenied(result.length === 0);
            setAccounts(result);
        });
    }, []);

    const filtered = filter
        ? accounts.filter((a) =>
              a.id.toLowerCase().includes(filter.toLowerCase()) ||
              (a.displayName ?? '').toLowerCase().includes(filter.toLowerCase()) ||
              (a.neupId ?? '').toLowerCase().includes(filter.toLowerCase()) ||
              a.accountType.toLowerCase().includes(filter.toLowerCase()),
          )
        : accounts;

    if (loading) {
        return (
            <div className="grid gap-6">
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-10 w-full" />
                <AccountListSkeleton />
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
        <div className="grid gap-6">
            <BackButton href="/manage" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
                <p className="text-muted-foreground">
                    {filter
                        ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${filter}"`
                        : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} total`}
                </p>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Filter by name, NeupID, or type..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10"
                />
            </div>

            {filtered.length > 0 ? (
                <div>
                    {filtered.map((acc, i) => (
                        <AccountRow
                            key={acc.id}
                            acc={acc}
                            isFirst={i === 0}
                            isLast={i === filtered.length - 1}
                        />
                    ))}
                </div>
            ) : (
                <div className="py-16 text-center text-muted-foreground">
                    No accounts found.
                </div>
            )}
        </div>
    );
}

export default function AccountsPage() {
    return (
        <Suspense fallback={
            <div className="grid gap-6 p-8">
                <Skeleton className="h-9 w-1/2" />
                <AccountListSkeleton />
            </div>
        }>
            <AccountsPageInner />
        </Suspense>
    );
}

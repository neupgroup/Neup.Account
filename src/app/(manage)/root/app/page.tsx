
"use client";

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronRight } from "@/components/icons";
import { getApps } from "./actions";
import type { Application } from '@/types';
import Link from "next/link";
import { useDebounce } from 'use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { checkPermissions } from '@/lib/user';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Ban } from '@/components/icons';


function AppManagementSkeleton() {
    return (
        <div className="grid gap-8">
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-10 w-32" />
                </CardHeader>
                <CardContent className="divide-y p-0">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-4 space-y-2">
                            <Skeleton className="h-5 w-1/3" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

export default function AppManagementPage() {
    const [apps, setApps] = useState<Application[]>([]);
    const [contentLoading, setContentLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
    const [permissionState, setPermissionState] = useState<'loading' | 'granted' | 'denied'>('loading');
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setContentLoading(true);
        const fetchedApps = await getApps(debouncedSearchQuery);
        setApps(fetchedApps);
        setContentLoading(false);
    }, [debouncedSearchQuery]);

    useEffect(() => {
        const verifyPermission = async () => {
            const hasPerm = await checkPermissions(['root.app.view']);
            setPermissionState(hasPerm ? 'granted' : 'denied');
        };
        verifyPermission();
    }, []);

    useEffect(() => {
        if(permissionState === 'granted') {
            fetchData();
        }
    }, [fetchData, permissionState]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard!" });
    };

    if (permissionState === 'loading') {
        return <AppManagementSkeleton />;
    }

    if (permissionState === 'denied') {
        return (
            <div className="grid gap-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">App Management</h1>
                </div>
                 <Alert variant="destructive">
                    <Ban className="h-4 w-4" />
                    <AlertTitle>Permission Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to view this page.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">App Management</h1>
                <p className="text-muted-foreground">
                    Create, view, and manage applications that can integrate with NeupID.
                </p>
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, ID, or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                     <Button asChild>
                        <Link href="/manage/root/app/create">
                            <Plus className="mr-2 h-4 w-4" />
                            Create New App
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {contentLoading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="p-4 space-y-2">
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            ))
                        ) : apps.length > 0 ? (
                            apps.map((app) => (
                                <Link
                                    key={app.id}
                                    href={`/manage/root/app/${app.id}`}
                                    className="block p-4 hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-grow">
                                            <p className="font-semibold group-hover:underline">{app.name}</p>
                                            <p className="text-sm font-mono text-muted-foreground">{app.id}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
                                </Link>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                <p>No applications found.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

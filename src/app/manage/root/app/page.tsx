

"use client";

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Copy } from "lucide-react";
import { getApps, type Application } from "./actions";
import Link from "next/link";
import { useDebounce } from 'use-debounce';
import { Skeleton } from '@/components/ui/skeleton';
import { checkPermissions } from '@/lib/user-actions';
import { useToast } from '@/hooks/use-toast';

export default function AppManagementPage() {
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
    const [canView, setCanView] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const verifyPermission = async () => {
            const hasPerm = await checkPermissions(['root.app.view']);
            setCanView(hasPerm);
        };
        verifyPermission();
    }, []);

    const fetchData = useCallback(async () => {
        if (!canView) {
            setLoading(false);
            return;
        };
        setLoading(true);
        const fetchedApps = await getApps(debouncedSearchQuery);
        setApps(fetchedApps);
        setLoading(false);
    }, [debouncedSearchQuery, canView]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard!" });
    };

    if (!canView) {
        return (
            <div className="grid gap-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">App Management</h1>
                    <p className="text-destructive">You do not have permission to view this page.</p>
                </div>
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
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>App Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>App Secret</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : apps.length > 0 ? (
                                apps.map((app) => (
                                    <TableRow key={app.id}>
                                        <TableCell className="font-medium align-top">
                                            <Link href={`/manage/root/app/${app.id}`} className="hover:underline">
                                                {app.name}
                                            </Link>
                                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                                                <span>{app.id}</span>
                                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(app.id)}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-top">{app.description}</TableCell>
                                        <TableCell className="align-top">
                                             <div className="font-mono text-xs flex items-center gap-2">
                                                <span className="truncate">{app.appSecret}</span>
                                                 <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(app.appSecret)}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No applications found.
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

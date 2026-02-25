"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from 'use-debounce';
import { getMasterPermissions } from '@/actions/manage/permission';
import type { Permission } from '@/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, UploadCloud, FilePlus, Search } from '@/components/icons';
import Link from 'next/link';
import { checkPermissions } from '@/lib/user';

const PAGE_SIZE = 10;

export default function PermissionsPage() {
    const { toast } = useToast();
    
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPrevPage, setHasPrevPage] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery] = useDebounce(searchQuery, 500);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { permissions, hasNextPage, hasPrevPage } = await getMasterPermissions(debouncedSearchQuery, page, PAGE_SIZE);
        setPermissions(permissions);
        setHasNextPage(hasNextPage);
        setHasPrevPage(hasPrevPage);
        setLoading(false);
    }, [page, debouncedSearchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handlePermissionTagClick = (permission: string) => {
        setSearchQuery(permission);
        setPage(1);
    }

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Permission Management</h1>
                <p className="text-muted-foreground">
                    Create, view, and report permission sets available across the system.
                </p>
            </div>

            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Create & Import</h2>
                <p className="text-muted-foreground text-sm">
                    Create a new permission set individually or import multiple sets at once.
                </p>
                <Card>
                    <CardContent className="divide-y p-0">
                         <Link href="/manage/permission/create" className="flex items-center gap-4 py-4 px-4 rounded-t-lg transition-colors hover:bg-muted/50">
                            <FilePlus className="h-6 w-6 text-muted-foreground" />
                            <div className="flex-grow">
                                <p className="font-medium">Create Permission Set</p>
                                <p className="text-sm text-muted-foreground">Define a single new reusable set of permissions.</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </Link>
                         <Link href="/manage/permission/bulk-import" className="flex items-center gap-4 py-4 px-4 rounded-b-lg transition-colors hover:bg-muted/50">
                            <UploadCloud className="h-6 w-6 text-muted-foreground" />
                            <div className="flex-grow">
                                <p className="font-medium">Bulk Import Permissions</p>
                                <p className="text-sm text-muted-foreground">Add multiple permission sets from a JSON structure.</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </Link>
                    </CardContent>
                </Card>
            </div>
            
            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">Permission Sets</h2>
                <p className="text-muted-foreground text-sm">
                    A list of all permission sets currently defined in the system.
                </p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by name, app slug, or permission..."
                        value={searchQuery}
                        onChange={(e) => {
                            setPage(1);
                            setSearchQuery(e.target.value);
                        }}
                        className="pl-10"
                    />
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Set Details</TableHead>
                                    <TableHead>Permissions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <>
                                        {[...Array(PAGE_SIZE)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                ) : permissions.length > 0 ? (
                                    permissions.map(perm => (
                                        <TableRow key={perm.id}>
                                            <TableCell className="align-top">
                                                 <Link href={`/manage/permission/${perm.id}`} className="font-semibold hover:underline">{perm.name}</Link>
                                                <p className="text-xs text-muted-foreground">{perm.description}</p>
                                                <button onClick={() => handlePermissionTagClick(perm.app_id)} className="text-xs text-muted-foreground font-mono mt-1 hover:underline">{perm.app_id}</button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {perm.access.map((a, index) => (
                                                        <button 
                                                            key={`${a}-${index}`}
                                                            onClick={() => handlePermissionTagClick(a)}
                                                            className="px-2 py-0.5 border rounded-md hover:bg-muted transition-colors text-sm"
                                                        >
                                                            {a}
                                                        </button>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">No permissions found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-2 border-t pt-4">
                        <Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={!hasPrevPage || loading}>
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
        </div>
    );
}

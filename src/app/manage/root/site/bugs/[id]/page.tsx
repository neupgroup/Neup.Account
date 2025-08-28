
'use client';

import { useEffect, useState, useTransition } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { getBugDetails, updateBugStatus, deleteBugReport } from '@/actions/root/site';
import type { BugReportDetails } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const InfoItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="text-sm font-medium">{value || "N/A"}</div>
    </div>
);

const statusVariantMap: { [key: string]: "default" | "destructive" | "secondary" } = {
    new: "destructive",
    in_progress: "secondary",
    solved: "default",
};

export default function BugDetailsPage({ params }: { params: { id: string } }) {
    const [bug, setBug] = useState<BugReportDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const fetchBug = async () => {
            setLoading(true);
            const data = await getBugDetails(params.id);
            if (!data) {
                notFound();
            }
            setBug(data);
            setLoading(false);
        };
        fetchBug();
    }, [params.id]);

    const handleStatusChange = (newStatus: 'new' | 'in_progress' | 'solved') => {
        startTransition(async () => {
            const result = await updateBugStatus(params.id, newStatus);
            if (result.success) {
                setBug(b => b ? { ...b, status: newStatus } : null);
                toast({ title: "Status Updated", className: "bg-accent text-accent-foreground" });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };
    
    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteBugReport(params.id);
            if (result.success) {
                toast({ title: "Bug Report Deleted" });
                router.push('/manage/root/site/bugs');
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    }

    if (loading || !bug) {
        return (
            <div className="grid gap-8">
                 <BackButton href="/manage/root/site/bugs" />
                 <Skeleton className="h-8 w-1/2" />
                 <div className="grid lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <Skeleton className="h-64 w-full" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-48 w-full" />
                    </div>
                 </div>
            </div>
        )
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site/bugs" />
             <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>{bug.title}</CardTitle>
                            <CardDescription>
                                Reported by {bug.reportedBy} on {bug.createdAt}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <pre className="text-sm bg-muted/50 p-4 rounded-md whitespace-pre-wrap font-sans break-all">
                                {bug.description}
                            </pre>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6 sticky top-24">
                    <Card>
                        <CardHeader>
                            <CardTitle>Details & Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <InfoItem label="Status" value={
                                <Select onValueChange={handleStatusChange} defaultValue={bug.status} disabled={isPending}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue>
                                             <Badge variant={statusVariantMap[bug.status] || 'secondary'}>{bug.status}</Badge>
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">New</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="solved">Solved</SelectItem>
                                    </SelectContent>
                                </Select>
                            } />
                            <InfoItem label="Report ID" value={<span className="font-mono text-xs">{bug.id}</span>} />
                            <InfoItem label="Reporter ID" value={<span className="font-mono text-xs">{bug.reporterId}</span>} />
                        </CardContent>
                        <CardFooter>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full" disabled={isPending}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Report
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this bug report. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                                            {isPending ? <Loader2 className="animate-spin" /> : "Delete"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

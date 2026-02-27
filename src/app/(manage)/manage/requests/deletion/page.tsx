
'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  getDeletionRequests,
  approveAccountDeletion,
  cancelAccountDeletion,
} from '@/actions/manage/requests/deletion';
import type { DeletionRequest } from '@/types';
import { checkPermissions } from '@/lib/user';
import { useToast } from '@/hooks/use-toast';
import { BackButton } from '@/components/ui/back-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Ban, Trash2, ShieldQuestion, Loader2 } from '@/components/icons';
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
} from '@/components/ui/alert-dialog';

function DeletionRequestRow({
  request,
  onAction,
}: {
  request: DeletionRequest;
  onAction: () => void;
}) {
  const [isApproving, startApproveTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();
  const { toast } = useToast();

  const handleApprove = () => {
    startApproveTransition(async () => {
      const result = await approveAccountDeletion(request.accountId);
      if (result.success) {
        toast({
          title: 'Account Deleted',
          description: 'The user account has been permanently deleted.',
        });
        onAction();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    });
  };
  const handleCancel = () => {
    startCancelTransition(async () => {
      const result = await cancelAccountDeletion(request.accountId);
      if (result.success) {
        toast({ title: 'Request Cancelled' });
        onAction();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    });
  };

  const isPending = isApproving || isCancelling;

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/manage/${request.accountId}`}
          className="font-medium text-primary hover:underline"
        >
          {request.userFullName}
        </Link>
        <p className="text-xs text-muted-foreground font-mono">
          {request.userNeupId}
        </p>
      </TableCell>
      <TableCell>{request.requestedAt}</TableCell>
      <TableCell className="text-right space-x-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Cancel Request
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Deletion Request?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the user's request and reactivate their
                account. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel}>
                {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Cancel Request
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isPending}>
              Approve Deletion
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Permanent Deletion?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is irreversible and will permanently delete the user's
                account and all associated data. Are you absolutely sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleApprove}
              >
                {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

export default function DeletionRequestsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<
    'loading' | 'granted' | 'denied'
  >('loading');

  const fetchRequests = async () => {
    setContentLoading(true);
    const data = await getDeletionRequests();
    setRequests(data);
    setContentLoading(false);
  };

  useEffect(() => {
    const verifyPermission = async () => {
      const canView = await checkPermissions(['root.requests.view']);
      setPermissionState(canView ? 'granted' : 'denied');
    };
    verifyPermission();
  }, []);

  useEffect(() => {
    if (permissionState === 'granted') {
      fetchRequests();
    }
  }, [permissionState]);

  if (permissionState === 'loading') {
    return <Skeleton className="h-96 w-full" />;
  }

  if (permissionState === 'denied') {
    return (
      <div className="grid gap-8">
        <BackButton href="/manage/requests" />
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertTitle>Permission Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view deletion requests.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <BackButton href="/manage/requests" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Account Deletion Requests
        </h1>
        <p className="text-muted-foreground">
          Approve or cancel pending account deletion requests from users.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
          <CardDescription>
            Users who have requested to delete their account will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Requested On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contentLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <DeletionRequestRow
                    key={req.accountId}
                    request={req}
                    onAction={fetchRequests}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No pending deletion requests.
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

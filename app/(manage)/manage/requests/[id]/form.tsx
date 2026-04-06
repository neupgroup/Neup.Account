
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/core/hooks/use-toast';
import { approveNeupIdRequest, denyNeupIdRequest } from '@/services/manage/requests/neupid';
import type { PendingNeupIdRequest } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
} from "@/components/ui/alert-dialog"
import { Loader2, Terminal } from 'lucide-react';
import { redirectInApp } from '@/core/helpers/navigation';


export function RequestDecisionForm({ request }: { request: PendingNeupIdRequest }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleApprove = async () => {
        setIsSubmitting(true);
        const result = await approveNeupIdRequest(request.id, request.accountId, request.requestedNeupId);
        if (result.success) {
            toast({ title: "Success", description: "Request approved successfully.", className: "bg-accent text-accent-foreground" });
            redirectInApp(router, '/manage/requests');
            router.refresh();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
            setIsSubmitting(false);
        }
    };

    const handleDeny = async () => {
        setIsSubmitting(true);
        const result = await denyNeupIdRequest(request.id);
        if (result.success) {
            toast({ title: "Success", description: "Request denied successfully." });
            redirectInApp(router, '/manage/requests');
            router.refresh();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
            setIsSubmitting(false);
        }
    };
    
    if (request.status !== 'pending') {
        return (
             <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Request Processed</AlertTitle>
                <AlertDescription>
                    This request has already been {request.status}. No further action can be taken.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex space-x-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isSubmitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to approve?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will grant the NeupID <span className="font-bold font-mono">{request.requestedNeupId}</span> to the user. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApprove} className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Approval
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deny
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to deny?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently deny the request for the NeupID <span className="font-bold font-mono">{request.requestedNeupId}</span>. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeny} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Denial
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

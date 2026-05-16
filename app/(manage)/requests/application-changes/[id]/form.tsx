'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/core/hooks/use-toast';
import { approveApplicationChangeRequest, denyApplicationChangeRequest } from '@/services/applications/change-requests';
import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';
import { redirectInApp } from '@/services/navigation';

type Props = {
  requestId: string;
  appId: string;
};

export function ApplicationChangeDecisionForm({ requestId, appId }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleApprove = async () => {
    setIsSubmitting(true);
    const result = await approveApplicationChangeRequest(requestId);
    if (result.success) {
      toast({ title: 'Approved', description: 'Changes have been applied to the application.' });
      redirectInApp(router, '/requests/application-changes');
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    setIsSubmitting(true);
    const result = await denyApplicationChangeRequest(requestId);
    if (result.success) {
      toast({ title: 'Denied', description: 'The change request has been rejected.' });
      redirectInApp(router, '/requests/application-changes');
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this change request?</AlertDialogTitle>
            <AlertDialogDescription>
              All proposed changes will be applied to the application immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isSubmitting}>
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
            <AlertDialogTitle>Deny this change request?</AlertDialogTitle>
            <AlertDialogDescription>
              The proposed changes will be discarded. The application will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeny}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Denial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

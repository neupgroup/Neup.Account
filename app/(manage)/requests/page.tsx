import { Suspense } from 'react';
import { checkPermissions } from '@/services/user';
import { getAllRequests } from '@/services/manage/requests/all';
import { REQUEST_TYPE_LABELS } from '@/services/manage/requests/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ban, ChevronRight } from '@/components/icons';
import { FlowLink } from '@/components/ui/flow-link';
import Link from 'next/link';
import { cn } from '@/core/helpers/utils';

type Props = {
  searchParams: Promise<{ type?: string; application?: string }>;
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending:  'secondary',
  approved: 'default',
  denied:   'destructive',
  rejected: 'destructive',
  revoked:  'destructive',
  active:   'default',
};

const TYPE_FILTERS = [
  { label: 'All',                key: undefined },
  { label: 'NeupID',             key: 'neupid_request' },
  { label: 'Display Name',       key: 'display_name_request' },
  { label: 'KYC',                key: 'kyc_request' },
  { label: 'KYC Verification',   key: 'kycVerification' },
  { label: 'App Changes',        key: 'applicationChange' },
  { label: 'Account Deletion',   key: 'accountDeletion' },
];

async function RequestsList({ type, application }: { type?: string; application?: string }) {
  const canView = await checkPermissions(['root.requests.view']);

  if (!canView) {
    return (
      <Alert variant="destructive">
        <Ban className="h-4 w-4" />
        <AlertTitle>Permission Denied</AlertTitle>
        <AlertDescription>You do not have permission to view requests.</AlertDescription>
      </Alert>
    );
  }

  const requests = await getAllRequests({ type, application });

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground text-sm">
          No requests found{type ? ` for type "${REQUEST_TYPE_LABELS[type] ?? type}"` : ''}.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {requests.map((req) => (
            <FlowLink
              key={req.id}
              href={`/requests/${req.id}`}
              className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {req.typeLabel}
                  </Badge>
                  <Badge
                    variant={statusVariant[req.status] ?? 'outline'}
                    className="capitalize text-xs shrink-0"
                  >
                    {req.status}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{req.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {req.submittedBy}{req.submittedAt ? ` · ${req.submittedAt}` : ''}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </FlowLink>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function RequestsPage({ searchParams }: Props) {
  const { type, application } = await searchParams;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
        <p className="text-muted-foreground">
          All requests across every type — pending and processed.
        </p>
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((filter) => {
          const isActive = filter.key === type || (!filter.key && !type);
          const href = filter.key
            ? `/requests?type=${filter.key}${application ? `&application=${application}` : ''}`
            : `/requests${application ? `?application=${application}` : ''}`;
          return (
            <Link
              key={filter.label}
              href={href}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                isActive
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <Suspense
        fallback={
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              Loading...
            </CardContent>
          </Card>
        }
      >
        <RequestsList type={type} application={application} />
      </Suspense>
    </div>
  );
}

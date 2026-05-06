import { FlowLink } from '@/components/ui/flow-link';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, FolderGit2, Shield } from '@/components/icons';
import { getAccessList } from '@/services/manage/access';
import { getActiveAccountId } from '@/core/auth/verify';
import { AddUserForm } from './add-user-form';

export default async function AccessControlPage() {
  const accountId = await getActiveAccountId();
  const accessList = accountId ? await getAccessList(accountId) : [];

  return (
    <div className="grid gap-8">
      <PrimaryHeader
        title="Access & Control"
        description="Manage who can access this account and what they can do."
      />

      {/* Grant access */}
      <div className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Grant Access</h2>
        <AddUserForm />
      </div>

      {/* People with access */}
      <div className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">People with Access</h2>
        {accessList.length > 0 ? (
          <div className="overflow-hidden rounded-lg border divide-y">
            {accessList.map((item) => (
              <FlowLink
                key={item.permitId}
                href={`/access/${item.permitId}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.permissions.join(', ')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </FlowLink>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dotted bg-transparent">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No one has been granted access yet.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Portfolios shortcut */}
      <div className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Portfolios</h2>
        <FlowLink href="/access/portfolio" className="group block">
          <Card className="transition-colors group-hover:bg-muted/30">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="font-medium">Manage Portfolios</p>
                  <p className="text-sm text-muted-foreground">Group assets and members into portfolios for structured access control.</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </FlowLink>
      </div>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { checkPermissions } from '@/services/user';
import { getApps } from '@/services/applications/manage';
import { FlowLink } from '@/components/ui/flow-link';
import { AppWindow } from '@/components/icons';

export default async function ManageApplicationsPage() {
    const isRootAppManager = await checkPermissions(['root.app.view']);
    const isBrandManager   = await checkPermissions(['linked_accounts.brand.manager']);

    if (!isRootAppManager && !isBrandManager) {
        notFound();
    }

    const applications = await getApps();

    return (
        <div className="grid gap-8">
            <BackButton href="/manage" />

            <div>
                <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
                <p className="text-muted-foreground">
                    All applications registered on the platform.
                </p>
            </div>

            {applications.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                    No applications found.
                </p>
            ) : (
                <div>
                    {applications.map((app, i) => {
                        const isFirst = i === 0;
                        const isLast  = i === applications.length - 1;

                        const roundingClass =
                            isFirst && isLast ? 'rounded-lg'
                            : isFirst          ? 'rounded-t-lg'
                            : isLast           ? 'rounded-b-lg'
                            : '';

                        return (
                            <FlowLink key={app.id} href={`/data/applications/${app.id}`}>
                                <div
                                    className={`
                                        flex items-center gap-4 px-4 py-3.5
                                        border border-border bg-card
                                        hover:bg-accent/40 transition-colors
                                        ${roundingClass}
                                        ${!isFirst ? '-mt-px' : ''}
                                    `}
                                >
                                    {/* Icon */}
                                    <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                                        <AppWindow className="h-4 w-4" />
                                    </div>

                                    {/* Name + ID */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate leading-tight">{app.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono truncate">{app.id}</p>
                                    </div>

                                    {/* Party badge */}
                                    {app.party && (
                                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                                            {app.party === 'first' ? '1st party' : '3rd party'}
                                        </Badge>
                                    )}
                                </div>
                            </FlowLink>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

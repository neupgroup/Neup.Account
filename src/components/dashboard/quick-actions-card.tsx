
"use client"
import { Card, CardContent } from '@/components/ui/card';
import { Laptop, ShieldCheck, Share2, FolderGit2, Building } from '@/components/icons';
import { getUserSessions } from '@/actions/security/sessions';
import { getTotpStatus } from '@/actions/security/totp';
import { getConnectedApplications } from '@/actions/data/applications';
import { getAccessList } from '@/app/manage/access/actions';
import { ListItem } from '../ui/list-item';
import { getAccountType } from '@/lib/user';
import { useSession } from '@/context/session-context';
import { SecondaryHeader } from '../ui/secondary-header';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';


type Action = {
    href: string;
    icon: React.ElementType;
    title: string;
    description: string;
};

function QuickActionsCardSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="h-6 w-1/4" />
            <Card>
                 <CardContent className="divide-y p-2">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 py-4 px-4">
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <div className="flex-grow space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}


export function QuickActionsCard() {
    const { isManaging, accountId } = useSession();
    const [actions, setActions] = useState<Action[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActions = async () => {
            if (!accountId) return;

            if (isManaging) {
                const brandActions = [
                    { href: '/manage/accounts/branches', icon: Building, title: 'Manage Branches', description: 'Oversee and configure your brand\'s locations.' },
                ];
                setActions(brandActions);
            } else {
                const [sessions, totpStatus, connectedApps, accessList] = await Promise.all([
                    getUserSessions(),
                    getTotpStatus(),
                    getConnectedApplications(),
                    getAccessList(accountId)
                ]);

                const sessionCount = sessions.length;
                const appCount = connectedApps.firstParty.length + connectedApps.thirdParty.length;
                const peopleCount = accessList.length;

                const individualActions = [
                    { href: '/manage/security/devices', icon: Laptop, title: 'Manage Devices', description: `You are logged in at ${sessionCount} place${sessionCount === 1 ? '' : 's'}.` },
                    { href: '/manage/security/totp', icon: ShieldCheck, title: 'Setup 2FA', description: totpStatus.isEnabled ? '2FA is active.' : '2FA is not active. You might be at risk.' },
                    { href: '/manage/data', icon: Share2, title: 'Manage Access', description: `Your account can be accessed by ${appCount} app${appCount === 1 ? '' : 's'}.` },
                    { href: '/manage/access', icon: FolderGit2, title: 'Permit Control', description: `Your account can be accessed by ${peopleCount} person${peopleCount === 1 ? '' : ''}.` },
                ];
                setActions(individualActions);
            }
            setLoading(false);
        };

        fetchActions();
    }, [isManaging, accountId]);

    if (loading) {
        return <QuickActionsCardSkeleton />;
    }

    if (actions.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <SecondaryHeader title="Quick Actions" />
            <Card>
                <CardContent className="divide-y p-2">
                    {actions.map(action => (
                        <ListItem key={action.href} {...action} />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

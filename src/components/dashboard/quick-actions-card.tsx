
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, Laptop, ShieldCheck, UserPlus, ChevronRight, Share2, FolderGit2 } from 'lucide-react';
import Link from 'next/link';
import { getUserSessions } from '@/app/manage/security/actions';
import { getTotpStatus } from '@/app/manage/security/totp/actions';
import { getConnectedApplications } from '@/app/manage/data/actions';
import { getAccessList } from '@/app/manage/access/actions';
import { getActiveAccountId } from '@/lib/auth-actions';

const ActionListItem = ({
    href,
    icon: Icon,
    title,
    description
}: {
    href: string,
    icon: React.ElementType,
    title: string,
    description: string
}) => (
     <Link href={href} className="flex items-center gap-4 py-3 px-2 rounded-lg transition-colors hover:bg-muted/50">
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);


export async function QuickActionsCard() {
    const accountId = await getActiveAccountId();
    if (!accountId) return null;

    const [
        sessions,
        totpStatus,
        connectedApps,
        accessList
    ] = await Promise.all([
        getUserSessions(),
        getTotpStatus(),
        getConnectedApplications(),
        getAccessList(accountId)
    ]);

    const sessionCount = sessions.length;
    const appCount = connectedApps.firstParty.length + connectedApps.thirdParty.length;
    const peopleCount = accessList.length;

    const actions = [
        { href: '/manage/security/devices', icon: Laptop, title: 'Manage Devices', description: `You are logged in at ${sessionCount} place${sessionCount === 1 ? '' : 's'}.` },
        { href: '/manage/security/totp', icon: ShieldCheck, title: 'Setup 2FA', description: totpStatus.isEnabled ? '2FA is active.' : '2FA is not active. You might be at risk.' },
        { href: '/manage/data', icon: Share2, title: 'Manage Access', description: `Your account can be accessed by ${appCount} app${appCount === 1 ? '' : 's'}.` },
        { href: '/manage/access', icon: FolderGit2, title: 'Permit Control', description: `Your account can be accessed by ${peopleCount} person${peopleCount === 1 ? '' : ''}.` },
    ];

    return (
        <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Quick Actions</h2>
            <Card>
                <CardContent className="divide-y p-2">
                    {actions.map(action => (
                        <ActionListItem key={action.href} {...action} />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

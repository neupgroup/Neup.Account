import { checkPermissions } from '@/services/user';
import { getUserStats } from '@/services/manage/accounts';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, UserPlus, ShieldCheck } from '@/components/icons';
import { SecondaryHeader } from '@/components/ui/secondary-header';
import Link from 'next/link';

export async function ManageStatsCard() {
    const canView = await checkPermissions(['root.dashboard.view']);
    if (!canView) return null;

    const stats = await getUserStats();

    const items = [
        {
            label: 'Total Accounts',
            value: stats.totalUsers,
            description: 'Across the entire system',
            icon: Users,
            href: '/manage',
        },
        {
            label: 'Active Accounts',
            value: stats.activeUsers,
            description: 'No status tracking yet',
            icon: UserCheck,
            href: '/manage?filter=active',
        },
        {
            label: 'Signed Up Today',
            value: stats.signedUpToday,
            description: 'New accounts in last 24h',
            icon: UserPlus,
            href: '/manage?sort=newest',
        },
        {
            label: 'Permissions Defined',
            value: stats.permissionsDefined,
            description: 'Total available permission sets',
            icon: ShieldCheck,
            href: null,
        },
    ];

    return (
        <div className="space-y-2">
            <SecondaryHeader
                title="System Overview"
                description="A snapshot of accounts and permissions across the platform."
            />
            <Card>
                <CardContent className="grid p-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    {items.map(({ label, value, description, icon: Icon, href }) => (
                        <div key={label} className="p-6">
                            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <h3 className="text-sm font-medium">{label}</h3>
                                <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {href ? (
                                <Link
                                    href={href}
                                    className="text-2xl font-bold hover:underline underline-offset-2 decoration-muted-foreground/50"
                                >
                                    {value}
                                </Link>
                            ) : (
                                <div className="text-2xl font-bold">{value}</div>
                            )}
                            <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

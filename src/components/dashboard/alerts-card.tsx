
"use client"

import { AlertTriangle, UserCheck } from 'lucide-react';
import { getTotpStatus } from '@/actions/security/totp';
import { getPendingNeupIdRequests } from '@/actions/root/requests/neupid';
import { checkPermissions } from '@/lib/user';
import { Card, CardContent } from '@/components/ui/card';
import { ListItem } from '../ui/list-item';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';

type AlertItem = {
    id: string;
    href: string;
    icon: React.ElementType;
    title: string;
    description: string;
    variant: 'destructive' | 'default';
};

function AlertsCardSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Card>
                <CardContent className="divide-y p-0">
                    <div className="flex items-center gap-4 py-4 px-4">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <div className="flex-grow space-y-2">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}


export function AlertsCard() {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            const totpStatus = await getTotpStatus();
            const canViewRequests = await checkPermissions(['root.requests.view']);
            
            let pendingNeupIdRequests = [];
            if (canViewRequests) {
                pendingNeupIdRequests = await getPendingNeupIdRequests();
            }

            const newAlerts: AlertItem[] = [];
            if (!totpStatus.isEnabled) {
                newAlerts.push({
                    id: '2fa',
                    href: '/manage/security/totp',
                    icon: AlertTriangle,
                    title: 'Enable Two-Factor Authentication',
                    description: 'Secure your account with an extra layer of protection.',
                    variant: 'destructive'
                });
            }

            if (pendingNeupIdRequests.length > 0) {
                newAlerts.push({
                    id: 'neupid',
                    href: '/manage/root/requests/neupid',
                    icon: UserCheck,
                    title: 'Review NeupID Requests',
                    description: `You have ${pendingNeupIdRequests.length} pending request${pendingNeupIdRequests.length > 1 ? 's' : ''}.`,
                    variant: 'default'
                });
            }

            setAlerts(newAlerts);
            setLoading(false);
        }

        fetchAlerts();
    }, []);


    if (loading) {
        return <AlertsCardSkeleton />;
    }

    if (alerts.length === 0) {
        return null;
    }
    
    return (
        <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Notifications</h2>
             <Card>
                <CardContent className="divide-y p-0">
                    {alerts.map(alert => (
                        <ListItem
                            key={alert.id}
                            href={alert.href}
                            icon={alert.icon}
                            title={alert.title}
                            description={alert.description}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

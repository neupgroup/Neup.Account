
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, UserCheck, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getTotpStatus } from '@/actions/security/totp';
import { getPendingNeupIdRequests } from '@/actions/root/requests/neupid/actions';
import { checkPermissions } from '@/lib/user-actions';
import { Card, CardContent } from '@/components/ui/card';


const AlertListItem = ({
    href,
    icon: Icon,
    title,
    description,
    variant = "destructive"
}: {
    href: string,
    icon: React.ElementType,
    title: string,
    description: string,
    variant?: "default" | "destructive"
}) => {
    const titleColor = variant === 'destructive' ? 'text-destructive' : 'text-foreground';

    return (
         <Link href={href} className="flex items-center gap-4 py-3 px-4 rounded-lg transition-colors hover:bg-muted/50">
            <Icon className={`h-6 w-6 ${variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className="flex-grow">
                <p className={`font-medium ${titleColor}`}>{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    )
};


export async function AlertsCard() {
    const totpStatus = await getTotpStatus();
    const [canViewRequests] = await Promise.all([
        checkPermissions(['root.requests.view'])
    ]);

    let pendingNeupIdRequests = [];
    if (canViewRequests) {
        pendingNeupIdRequests = await getPendingNeupIdRequests();
    }
    
    const alerts = [];
    if (!totpStatus.isEnabled) {
        alerts.push({
            id: '2fa',
            href: '/manage/security/totp',
            icon: AlertTriangle,
            title: 'Enable Two-Factor Authentication',
            description: 'Secure your account with an extra layer of protection.',
            variant: 'destructive'
        });
    }

    if (pendingNeupIdRequests.length > 0) {
        alerts.push({
            id: 'neupid',
            href: '/manage/root/requests/neupid',
            icon: UserCheck,
            title: 'Review NeupID Requests',
            description: `You have ${pendingNeupIdRequests.length} pending request${pendingNeupIdRequests.length > 1 ? 's' : ''}.`,
            variant: 'default'
        });
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
                        <AlertListItem
                            key={alert.id}
                            href={alert.href}
                            icon={alert.icon}
                            title={alert.title}
                            description={alert.description}
                            variant={alert.variant as "default" | "destructive"}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

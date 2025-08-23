
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronRight, Wallet, Gem } from 'lucide-react';

const BillingListItem = ({
    href,
    icon: Icon,
    title,
    description,
    isExternal = false
}: {
    href: string,
    icon: React.ElementType,
    title: string,
    description: string,
    isExternal?: boolean
}) => (
     <Link 
        href={href} 
        className="flex items-center gap-4 py-3 px-2 rounded-lg transition-colors hover:bg-muted/50"
        target={isExternal ? "_blank" : "_self"}
        rel={isExternal ? "noopener noreferrer" : ""}
    >
        <Icon className="h-6 w-6 text-muted-foreground" />
        <div className="flex-grow">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
);


export async function BillingCard() {
    // Mock data for now
    const plan = "Neup.Pro";
    const nextCharge = "$29.00 on Nov 1, 2024";

    const billingItems = [
        { href: '/manage/payment', icon: Wallet, title: 'Manage Subscription', description: `Your next charge is ${nextCharge}.` },
        { href: 'https://neupgroup.com/wallet/history?source=neup', icon: Gem, title: 'Upgrade Plan', description: 'Unlock premium features by upgrading your plan.', isExternal: true },
    ]

    return (
         <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Billing & Subscription</h2>
            <p className="text-muted-foreground text-sm">
                Your current plan is <span className="font-semibold text-foreground">{plan}</span>.
            </p>
            <Card>
                <CardContent className="divide-y p-2">
                     {billingItems.map((item) => (
                        <BillingListItem 
                            key={item.href}
                            href={item.href}
                            icon={item.icon}
                            title={item.title}
                            description={item.description}
                            isExternal={item.isExternal}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

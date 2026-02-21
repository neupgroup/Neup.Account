"use client"

import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Laptop, Link, AppWindow, Users } from '@/components/icons';
import { ListItem } from '../ui/list-item';
import { SecondaryHeader } from '../ui/secondary-header';

export function SettingsCard() {
    const settingsItems = [
        { 
            href: '/security/password', 
            icon: ShieldCheck, 
            title: 'Password and Security', 
            description: 'Update your password and security settings.' 
        },
        { 
            href: '/security/devices', 
            icon: Laptop, 
            title: 'Security and Session', 
            description: 'Manage your active sessions and devices.' 
        },
        { 
            href: '/accounts/link', 
            icon: Link, 
            title: 'Linked Accounts', 
            description: 'Manage accounts linked to your profile.' 
        },
        { 
            href: '/access', 
            icon: AppWindow, 
            title: 'Access and Control', 
            description: 'Control which apps can access your data.' 
        },
        { 
            href: '/people', 
            icon: Users, 
            title: 'People and Sharing', 
            description: 'Manage family members and sharing options.' 
        },
    ]

    return (
         <div className="space-y-2">
            <SecondaryHeader 
                title="Account Settings"
                description="Manage your account security and preferences."
            />
            <Card>
                <CardContent className="divide-y p-2">
                     {settingsItems.map((item) => (
                        <ListItem key={item.href} {...item} />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

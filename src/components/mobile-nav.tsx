

import Link from "next/link";
import {
    ChevronRight,
    type LucideIcon,
    Home,
    UserCircle,
    Key,
    Combine,
    Database,
    FolderGit2,
    HeartHandshake,
    Gem,
    Users,
    LogOut,
    ArrowLeft,
    AppWindow,
    AlertTriangle,
    Wallet,
    ShieldCheck,
    Clock,
    Bell
} from "@/components/icons";
import { getNavConfig, NavItem, NavSection } from "./nav-data";
import { Card, CardContent } from "./ui/card";
import { NotificationBell } from "./warning-display";

const iconMap: { [key: string]: LucideIcon | React.ElementType } = {
    Home: Home,
    "PersonalInfo": UserCircle,
    "Notifications": NotificationBell,
    "PasswordAndSecurity": Key,
    "LinkedAccounts": Combine,
    "DataAndPrivacy": Database,
    "AccessAndControl": FolderGit2,
    "PeopleAndSharing": HeartHandshake,
    "PaymentAndSubscription": Gem,
    "SwitchAccount": Users,
    "SignOutAccount": LogOut,
    "SwitchBack": ArrowLeft,
    "Dashboard": Home,
    "Account Management": Users,
    "Requests Management": Clock,
    "PermissionManagement": ShieldCheck,
    "AppManagement": AppWindow,
    "SystemErrors": AlertTriangle,
    "PaymentDetails": Wallet,
    "BrandInfo": UserCircle,
    UserCircle: UserCircle, // Fallback
}


const NavListItem = ({
    href,
    title,
    description,
    iconName
}: {
    href: string,
    title: string,
    description: string,
    iconName: string
}) => {
    const Icon = iconMap[iconName] || UserCircle;
    return (
        <Link href={href} className="flex items-center gap-4 py-4 px-4 rounded-lg transition-colors hover:bg-muted/50">
            <Icon className="h-6 w-6 text-muted-foreground" />
            <div className="flex-grow">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    )
};

export async function MobileNav() {
    const navConfig = await getNavConfig();

    return (
        <div className="grid gap-8">
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Menu</h1>
                <p className="text-muted-foreground">
                    Navigate to different sections of your account.
                </p>
            </div>
            {navConfig.map((section: NavSection) => (
                 <div key={section.title || 'main'} className="space-y-2">
                    {section.title && <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>}
                     <Card>
                        <CardContent className="divide-y p-0">
                           {section.items.map((item, index) => (
                               <NavListItem key={index} href={item.href} title={item.label} description={item.description} iconName={item.iconName} />
                            ))}
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}

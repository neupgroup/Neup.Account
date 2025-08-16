

import { getNavConfig } from "@/components/nav-data";
import { HomeNavList } from "@/components/home/home-nav-list";
import { Card, CardContent } from "@/components/ui/card";

export default async function HomePage() {
    
    const navConfig = await getNavConfig();

    const allItems = navConfig.flatMap(section => section.items);
    const hasVisibleItems = allItems.filter(item => item.href !== '/manage/home').length > 0;

    return (
        <div className="grid gap-8">
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Home</h1>
                <p className="text-muted-foreground">
                    Your central hub for managing your NeupID account.
                </p>
            </div>

            {navConfig.map(section => (
                 <div key={section.title || 'main'} className="space-y-2">
                    {section.title && <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>}
                    <HomeNavList items={section.items} />
                </div>
            ))}

            {!hasVisibleItems && (
                 <Card>
                    <CardContent className="p-6 text-left text-muted-foreground">
                        <p>You do not have permission to view any settings.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

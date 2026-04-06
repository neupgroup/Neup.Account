
import { getBrandAccounts } from "@/services/manage/accounts/brand";
import { notFound } from "next/navigation";
import { getPersonalAccountId } from "@/core/helpers/auth-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AccountListItem } from "@/app/auth/accounts/account-list-item";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/icons";
import Link from "next/link";
import { Building } from "lucide-react";
import { SecondaryHeader } from "@/components/ui/secondary-header";

export default async function BrandAccountsPage() {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        // This page is only for personal accounts to manage brands.
        notFound();
    }
    const brandAccounts = await getBrandAccounts();

    const mappedBrandAccounts = brandAccounts.map(brand => ({
        accountId: brand.id,
        sessionId: '',
        sessionKey: '',
        expired: false,
        isBrand: true,
        displayName: brand.name,
        neupId: `brand`, // Placeholder
        displayPhoto: brand.logoUrl,
        plan: brand.plan,
    }));

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Manage Brand Accounts</h1>
                <p className="text-muted-foreground">
                    Select a brand to manage or create a new one.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <SecondaryHeader
                        title="Your Brands"
                        description="A list of all brand accounts you manage. Select one to manage it."
                    />
                </CardHeader>
                <CardContent className="p-0 divide-y">
                    {mappedBrandAccounts.length > 0 ? (
                        mappedBrandAccounts.map(acc => (
                            <AccountListItem
                                key={acc.accountId}
                                account={acc}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 gap-4">
                            <Building className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="text-lg font-semibold">No Brand Accounts Found</h3>
                            <p className="text-sm text-muted-foreground">
                                You don't manage any brand accounts yet. Get started by creating one.
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardContent className="pt-6 border-t">
                    <Button asChild>
                        <Link href="/accounts/brand/create"><Plus className="mr-2 h-4 w-4" />Create New Brand</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

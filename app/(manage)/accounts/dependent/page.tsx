import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDependentAccounts } from "@/services/manage/accounts/dependent";
import { User, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { AccountListItem } from "@/app/auth/accounts/account-list-item";
import { BackButton } from "@/components/ui/back-button";
import { checkPermissions } from "@/lib/user";

export default async function DependentAccountsPage() {
    const canView = await checkPermissions(['linked_accounts.dependent.view']);
    if (!canView) {
        notFound();
    }

    const dependentAccounts = await getDependentAccounts();

    const mappedAccounts = dependentAccounts.map(acc => ({
        accountId: acc.id,
        sessionId: '',
        sessionKey: '',
        expired: false,
        displayName: acc.nameDisplay || '',
        neupId: acc.neupId || '',
        displayPhoto: acc.accountPhoto || '',
        isDependent: true,
    }));

    return (
        <div className="grid gap-8">
            <BackButton href="/accounts" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Manage Dependent Accounts</h1>
                <p className="text-muted-foreground">
                    Oversee and manage accounts under your care.
                </p>
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Your Dependents</CardTitle>
                        <CardDescription>
                            A list of all accounts you manage.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                    {mappedAccounts.length > 0 ? (
                        mappedAccounts.map(acc => (
                            <AccountListItem key={acc.accountId} account={acc} />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 gap-4">
                            <User className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="text-lg font-semibold">No Dependent Accounts Found</h3>
                            <p className="text-sm text-muted-foreground">
                                Get started by creating an account for a family member.
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardContent className="pt-6 border-t">
                    <Button asChild>
                        <Link href="/accounts/dependent/create"><Plus className="mr-2 h-4 w-4" />Create New Dependent</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecoveryAccounts } from "./actions";
import { RecoveryAccountManager } from "./recovery-account-manager";
import { BackButton } from "@/components/ui/back-button";

export default async function RecoveryAccountPage() {
    const initialAccounts = await getRecoveryAccounts();

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/security" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Recovery Accounts</h1>
                <p className="text-muted-foreground">
                    Designate other NeupID accounts that can help you recover access if you get locked out.
                </p>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Manage Recovery Accounts</h2>
                <p className="text-muted-foreground text-sm">
                    You can add up to 5 trusted accounts. These people can help you get back into your account if you forget your password or it's compromised.
                </p>
                <Card>
                    <CardContent className="p-6">
                         <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                            <h3 className="font-bold">Important Security Warning</h3>
                            <p className="mt-1">
                               If a recovery contact reports that your account is compromised, your account will be <span className="font-bold">immediately locked</span> to prevent further unauthorized access. You will then need to go through a verification process to regain access.
                            </p>
                        </div>
                        <RecoveryAccountManager initialAccounts={initialAccounts} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}



"use client";

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserProfile, getUserNeupIds } from '@/lib/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { switchActiveAccount, switchToBrand, switchToDependent, removeStoredAccount, logoutStoredSession } from '@/actions/auth/switch';
import { ChevronRight, Loader2 } from '@/components/icons';
import type { StoredAccount } from '@/types';
import { Button } from '@/components/ui/button';

type CombinedAccount = StoredAccount & {
    displayName?: string;
    neupId?: string;
    displayPhoto?: string;
    isBrand?: boolean;
    isDependent?: boolean;
    plan?: string;
    isUnknown?: boolean;
};

export function AccountListItem({ account, mode }: { account: CombinedAccount, mode: 'link' | 'switch' }) {
    const [details, setDetails] = useState<Partial<CombinedAccount>>({
        displayName: account.displayName,
        neupId: account.neupId,
        displayPhoto: account.displayPhoto,
    });
    const [loading, setLoading] = useState(true);
    const [isSwitching, startSwitchTransition] = useTransition();
    const [isActionPending, startActionTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        async function fetchAccountDetails() {
            setLoading(true);
            if (account.isBrand || account.isDependent || account.isUnknown) {
                setLoading(false);
                return;
            }

            if (!account.accountId) {
                setDetails({ isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown' });
                setLoading(false);
                return;
            }

            try {
                const [profile, neupIds] = await Promise.all([
                    getUserProfile(account.accountId),
                    getUserNeupIds(account.accountId)
                ]);

                if (profile) {
                     setDetails({
                        displayName: profile.nameDisplay || `${profile.nameFirst} ${profile.nameLast}`.trim(),
                        neupId: neupIds.find(id => profile.neupIdPrimary === id) || neupIds[0] || 'N/A',
                        displayPhoto: profile.accountPhoto
                    });
                } else {
                     setDetails({
                        displayName: 'Unknown Account',
                        neupId: neupIds[0] || 'N/A',
                     });
                }
            } catch (e) {
                setDetails({ isUnknown: true, displayName: 'Error Loading', neupId: 'error' });
            } finally {
                setLoading(false);
            }
        }

        fetchAccountDetails();
    }, [account.accountId, account.isBrand, account.isDependent, account.isUnknown]);

    const finalAccount = { ...account, ...details };

    const handleSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (loading || isSwitching || isActionPending) return;

        startSwitchTransition(async () => {
            let result;
            if (finalAccount.isBrand) {
                result = await switchToBrand(finalAccount.accountId);
            } else if (finalAccount.isDependent) {
                 result = await switchToDependent(finalAccount.accountId);
            } else {
                result = await switchActiveAccount(finalAccount);
            }

            if (result.success) {
                toast({ title: "Success", description: "Switched account successfully." });
                router.push('/manage');
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };

    const handleSignOut = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        startActionTransition(async () => {
            const result = await logoutStoredSession(account.sessionId);
            if (result.success) {
                toast({ title: "Signed Out", description: "The account session has been signed out." });
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        startActionTransition(async () => {
            const result = await removeStoredAccount(account.accountId);
            if (result.success) {
                toast({ title: "Account Removed", description: "The account has been removed from this device." });
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };
    
    if (loading) {
        return (
             <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                    </div>
                </div>
                 <Skeleton className="h-8 w-20" />
            </div>
        )
    }

    const href = finalAccount.expired ? `/auth/signin?neupId=${finalAccount.neupId}` : `/manage`;
    
    const Wrapper = mode === 'link' || finalAccount.expired
        ? (({children}: {children: React.ReactNode}) => <Link href={href} className="block hover:bg-muted/50 transition-colors">{children}</Link>)
        : (({children}: {children: React.ReactNode}) => <div onClick={handleSwitch} className="block hover:bg-muted/50 transition-colors cursor-pointer">{children}</div>);

    return (
        <Wrapper>
            <div className="flex items-center justify-between p-4">
                 <div className="flex items-center gap-4">
                    <Avatar>
                        <AvatarImage src={finalAccount.displayPhoto} data-ai-hint={finalAccount.isBrand ? 'logo' : 'person'} />
                        <AvatarFallback />
                    </Avatar>
                    <div>
                        <p className="font-semibold">{finalAccount.displayName || 'Unnamed Account'}</p>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground mt-1">
                               @{finalAccount.neupId}
                            </p>
                            {finalAccount.expired && (
                                <p className="text-xs text-destructive mt-1">
                                    (Expired)
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                     {finalAccount.isUnknown ? (
                        <Button variant="outline" size="sm" onClick={handleRemove} disabled={isActionPending}>
                            {isActionPending ? <Loader2 className="animate-spin" /> : 'Remove'}
                        </Button>
                    ) : finalAccount.expired ? (
                        <Button variant="outline" size="sm" onClick={handleRemove} disabled={isActionPending}>
                             {isActionPending ? <Loader2 className="animate-spin" /> : 'Remove'}
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleSignOut} disabled={isActionPending}>
                             {isActionPending ? <Loader2 className="animate-spin" /> : 'Sign Out'}
                        </Button>
                    )}
                </div>
            </div>
        </Wrapper>
    );
}

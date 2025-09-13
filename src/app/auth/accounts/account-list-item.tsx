

"use client";

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, getUserNeupIds } from '@/lib/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { switchActiveAccount, switchToBrand, switchToDependent } from '@/actions/auth/switch';
import { ChevronRight, Loader2 } from '@/components/icons';
import type { StoredAccount } from '@/types';

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
    const [details, setDetails] = useState<Partial<CombinedAccount>>({});
    const [loading, setLoading] = useState(true);
    const [isSwitching, startSwitchTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        async function fetchAccountDetails() {
            if (account.isBrand || account.isDependent || account.isUnknown) {
                // Details are already passed in for these types
                setDetails({}); 
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

                if (!profile) {
                    setDetails({ isUnknown: true, displayName: 'Unknown Account', neupId: 'unknown' });
                } else {
                    setDetails({
                        displayName: profile?.displayName || `${profile?.firstName} ${profile?.lastName}`.trim(),
                        neupId: neupIds[0] || 'N/A',
                        displayPhoto: profile?.accountPhoto
                    });
                }
            } catch (e) {
                setDetails({ isUnknown: true, displayName: 'Error Loading', neupId: 'error' });
            } finally {
                setLoading(false);
            }
        }

        fetchAccountDetails();
    }, [account]);

    const finalAccount = { ...account, ...details };

    const handleSwitch = (acc: CombinedAccount) => {
        startSwitchTransition(async () => {
            let result;
            if (acc.isBrand) {
                result = await switchToBrand(acc.accountId);
            } else if (acc.isDependent) {
                 result = await switchToDependent(acc.accountId);
            } else {
                result = await switchActiveAccount(acc);
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

    const handleClick = () => {
        if (loading || isSwitching) return;
        if (mode === 'link' || finalAccount.expired) {
            router.push(`/auth/signin?neupId=${finalAccount.neupId}`);
        } else {
            handleSwitch(finalAccount);
        }
    };
    
    if (loading) {
        return (
             <div className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                   <Skeleton className="h-4 w-32" />
                   <Skeleton className="h-3 w-24" />
                </div>
            </div>
        )
    }

    return (
        <button
            onClick={handleClick}
            className="w-full text-left flex items-center justify-between p-4 group hover:bg-muted/50 transition-colors disabled:opacity-50"
            disabled={isSwitching || finalAccount.isUnknown}
        >
             <div className="flex items-center gap-4">
                <Avatar>
                    <AvatarImage src={finalAccount.displayPhoto} data-ai-hint={finalAccount.isBrand ? 'logo' : 'person'} />
                    <AvatarFallback />
                </Avatar>
                <div>
                    <p className="font-semibold">{finalAccount.displayName || 'Unknown Account'}</p>
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
            {isSwitching ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </button>
    );
}

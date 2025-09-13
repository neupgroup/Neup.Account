

"use client";

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, getUserNeupIds } from '@/lib/user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { switchActiveAccount, switchToBrand, switchToDependent } from '@/actions/auth/switch';
import { ChevronRight, Loader2 } from '@/components/icons';
import type { StoredAccount } from '@/types';
import { AccountActions } from './account-actions';

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

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent click if it's on a button inside
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }

        if (loading || isSwitching) return;
        
        if (mode === 'link' || finalAccount.expired) {
             router.push(`/auth/signin?neupId=${finalAccount.neupId}`);
        } else {
            handleSwitch(finalAccount);
        }
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

    return (
        <div
            onClick={handleClick}
            className="w-full text-left flex items-center justify-between p-4 group hover:bg-muted/50 transition-colors cursor-pointer"
            aria-disabled={isSwitching || finalAccount.isUnknown}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as any); }}
        >
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
            <div data-action-button="true">
                <AccountActions account={finalAccount} />
            </div>
        </div>
    );
}


'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type VerificationDetails = {
    category: string;
    verifiedAt: string;
};

export function VerifiedBadge({ accountId, className }: { accountId: string, className?: string }) {
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null);

    useEffect(() => {
        if (!accountId) return;

        const checkVerification = async () => {
            const accountRef = doc(db, 'account', accountId);
            try {
                const docSnap = await getDoc(accountRef);
                if (docSnap.exists() && docSnap.data().verified === true) {
                    setIsVerified(true);
                    
                    const verificationRef = doc(db, 'verifications', accountId);
                    const verificationSnap = await getDoc(verificationRef);
                     if (verificationSnap.exists()) {
                         const data = verificationSnap.data();
                         setVerificationDetails({
                            category: data.category,
                            verifiedAt: data.verifiedAt?.toDate().toLocaleDateString() || 'N/A',
                        });
                     }

                } else {
                    setIsVerified(false);
                }
            } catch (error) {
                console.error("Error fetching verification status:", error);
                setIsVerified(false);
            }
        };

        checkVerification();
    }, [accountId]);

    if (!isVerified) {
        return null;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <CheckCircle2 className={cn("h-6 w-6 text-primary fill-blue-100", className)} />
                </TooltipTrigger>
                {verificationDetails && (
                    <TooltipContent>
                        <p className="font-semibold">Verified as {verificationDetails.category}</p>
                        <p className="text-xs text-muted-foreground">
                            Date: {verificationDetails.verifiedAt}
                        </p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

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
    const [verification, setVerification] = useState<VerificationDetails | null>(null);

    useEffect(() => {
        if (!accountId) return;

        const checkVerification = async () => {
            const verificationRef = doc(db, 'verifications', accountId);
            try {
                const docSnap = await getDoc(verificationRef);
                if (docSnap.exists() && docSnap.data().status === 'approved') {
                    const data = docSnap.data();
                    setVerification({
                        category: data.category,
                        verifiedAt: data.verifiedAt?.toDate().toLocaleDateString() || 'N/A',
                    });
                } else {
                    setVerification(null);
                }
            } catch (error) {
                console.error("Error fetching verification status:", error);
                setVerification(null);
            }
        };

        checkVerification();
    }, [accountId]);

    if (!verification) {
        return null;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <CheckCircle2 className={cn("h-6 w-6 text-primary fill-blue-100", className)} />
                </TooltipTrigger>
                <TooltipContent>
                    <p className="font-semibold">Verified as {verification.category}</p>
                    <p className="text-xs text-muted-foreground">
                        Date: {verification.verifiedAt}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

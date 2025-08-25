

"use client"

import { useEffect, useState } from 'react'
import { IndividualProfileForm } from '@/app/manage/profile/individual-form'
import { getActiveAccountId } from '@/actions/auth/session'

export default function ProfilePage() {
    const [accountId, setAccountId] = useState<string | null>(null);

    useEffect(() => {
        const fetchAccountId = async () => {
            const id = await getActiveAccountId();
            setAccountId(id);
        };
        fetchAccountId();
    }, []);

    if (!accountId) {
        return <div>Loading...</div>; // Or a proper skeleton loader
    }

    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Personal Information</h1>
            <p className="text-muted-foreground mb-8">
                Manage your personal details and contact information.
            </p>
            <IndividualProfileForm accountId={accountId} />
        </div>
    )
}

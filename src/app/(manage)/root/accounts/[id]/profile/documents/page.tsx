
import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { getUserDetails } from '@/actions/root/users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function RootUserKycPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userDetails = await getUserDetails(id);

    if (!userDetails) {
        notFound();
    }

    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/root/accounts/${id}/profile`} />
            <PrimaryHeader
                title="KYC & Verification"
                description={`Review KYC status and submitted documents for @${userDetails.neupId}.`}
            />
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        The ability to view and manage user-submitted KYC documents will be available here soon.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

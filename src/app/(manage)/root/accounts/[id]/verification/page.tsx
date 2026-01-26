import { notFound } from "next/navigation";
import { getUserDetails, getAccountDetails } from "@/actions/root/users";
import { VerificationManager } from "./form";
import { BackButton } from "@/components/ui/back-button";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function UserVerificationPage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
     if (!userDetails) {
        notFound();
    }
    
    return (
        <div className="grid gap-8">
            <div className="space-y-4">
                <BackButton href={`/manage/root/accounts/${params.id}`} />
                 <PrimaryHeader
                    title="Manage Verification"
                    description={`Grant or revoke verification for @${userDetails.neupId}.`}
                />
            </div>
            
            <VerificationManager accountId={userDetails.accountId} />
        </div>
    );
}

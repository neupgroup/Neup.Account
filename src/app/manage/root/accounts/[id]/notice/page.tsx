

import { notFound } from "next/navigation";
import { getUserDetails, getAccountDetails } from "@/actions/root/users";
import { BlockServiceAccessForm, SendWarningForm } from "../forms";
import { BackButton } from "@/components/ui/back-button";
import { PrimaryHeader } from "@/components/ui/primary-header";


export default async function UserNoticePage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
     if (!userDetails) {
        notFound();
    }
    
    const accountDetails = await getAccountDetails(params.id);

    return (
        <div className="grid gap-8">
            <div className="space-y-4">
                <BackButton href={`/manage/root/accounts/${params.id}`} />
                 <PrimaryHeader
                    title="Manage Notices & Actions"
                    description={`Send warnings or apply administrative actions to @${userDetails.neupId}.`}
                />
            </div>
            
            <SendWarningForm userId={userDetails.accountId} />

            <div className="border-t pt-8">
                <BlockServiceAccessForm 
                    userId={userDetails.accountId} 
                    currentBlock={accountDetails?.block || null} 
                />
            </div>
        </div>
    );
}

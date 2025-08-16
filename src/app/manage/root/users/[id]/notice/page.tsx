

import { notFound } from "next/navigation";
import { getUserDetails, getAccountDetails } from "../actions";
import { BlockServiceAccessForm, SendWarningForm } from "../forms";
import { BackButton } from "@/components/ui/back-button";


export default async function UserNoticePage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
     if (!userDetails) {
        notFound();
    }
    
    const accountDetails = await getAccountDetails(params.id);

    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/root/users/${params.id}`} />
            <div>
                 <h1 className="text-3xl font-bold tracking-tight">Manage Notices & Actions</h1>
                <p className="text-muted-foreground">
                    Send warnings or apply administrative actions to @{params.id}.
                </p>
            </div>
            
            <SendWarningForm userId={userDetails.accountId} />

            <div className="border-t pt-6">
                <BlockServiceAccessForm 
                    userId={userDetails.accountId} 
                    currentBlock={accountDetails?.block || null} 
                />
            </div>
        </div>
    );
}


import { notFound } from "next/navigation";
import { getUserDetails } from "@/actions/root/users";
import { UserDetailsClient } from "./user-details-client";
import { checkPermissions } from "@/lib/user";

export default async function AccountDetailsPage({ params }: { params: { id: string } }) {
    const canView = await checkPermissions(['root.account.view_full', 'root.account.view_limited1', 'root.account.view_limited2']);
    if (!canView) {
        notFound();
    }
    
    // The param is now the accountId
    const userDetails = await getUserDetails(params.id);

    if (!userDetails) {
        notFound();
    }

    return <UserDetailsClient initialUserDetails={userDetails} />;
}

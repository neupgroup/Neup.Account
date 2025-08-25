
import { notFound } from "next/navigation";
import { getUserDetails } from "@/actions/root/users";
import { UserDetailsClient } from "./user-details-client";
import { checkPermissions } from "@/lib/user-actions";

export default async function UserDetailsPage({ params }: { params: { id: string } }) {
    const canView = await checkPermissions(['root.account.view_full', 'root.account.view_limited1', 'root.account.view_limited2']);
    if (!canView) {
        notFound();
    }
    
    const userDetails = await getUserDetails(params.id);

    if (!userDetails) {
        notFound();
    }

    return <UserDetailsClient initialUserDetails={userDetails} />;
}

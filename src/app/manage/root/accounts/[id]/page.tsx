
import { notFound } from "next/navigation";
import { getUserDetails } from "@/actions/root/users";
import { UserDetailsClient } from "./user-details-client";
import { checkPermissions } from "@/lib/user";

export default async function AccountDetailsPage({ params }: { params: { id: string } }) {
    const canView = await checkPermissions(['root.account.view_full', 'root.account.view_limited1', 'root.account.view_limited2']);
    if (!canView) {
        notFound();
    }
    
    const userDetails = await getUserDetails(params.id);

    if (!userDetails) {
        notFound();
    }

    const serializableUserDetails = {
        ...userDetails,
        profile: {
            ...userDetails.profile,
            dob: userDetails.profile.dob ? new Date(userDetails.profile.dob.seconds * 1000).toISOString() : null,
        },
    };

    return (
        <UserDetailsClient 
            initialUserDetails={serializableUserDetails}
        />
    );
}

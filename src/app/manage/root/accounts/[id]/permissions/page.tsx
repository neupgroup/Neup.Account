
import { notFound } from "next/navigation";
import { getPermissions, getUserDetails } from "@/actions/root/users";
import { getAccountType } from "@/lib/user";
import { getMasterPermissions } from "@/actions/root/permission";
import { BackButton } from "@/components/ui/back-button";
import { PermissionEditor } from "./form";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function UserPermissionsPage({ params }: { params: { id: string } }) {
    const userDetails = await getUserDetails(params.id);
    if (!userDetails) {
        notFound();
    }

    const [userPermissions, allPermissionsResponse, accountType] = await Promise.all([
        getPermissions(params.id),
        getMasterPermissions("", 1, 9999), // Fetch all permissions
        getAccountType(params.id),
    ]);

    // Filter permissions to only show those intended for the user's account type, plus root permissions.
    const assignablePermissions = allPermissionsResponse.permissions.filter(p => {
        if (p.intended_for === 'root') return true;
        return p.intended_for === accountType;
    });
    
    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/root/accounts/${params.id}`} />
            <PrimaryHeader
                title="Manage User Permissions"
                description={`Assign or restrict permission sets for @${userDetails.neupId}.`}
            />
            <PermissionEditor 
                accountId={params.id}
                allPermissionSets={assignablePermissions}
                initialAssignedSetIds={userPermissions.assignedPermissionSetIds}
                initialRestrictedSetIds={userPermissions.restrictedPermissionSetIds}
            />
        </div>
    );
}

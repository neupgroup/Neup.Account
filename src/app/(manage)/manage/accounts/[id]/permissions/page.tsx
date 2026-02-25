
import { notFound } from "next/navigation";
import { getPermissions, getUserDetails } from "@/actions/manage/users";
import { getAccountType } from "@/lib/user";
import { getMasterPermissions } from "@/actions/manage/permission";
import { BackButton } from "@/components/ui/back-button";
import { PermissionEditor } from "./form";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function UserPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userDetails = await getUserDetails(id);
    if (!userDetails) {
        notFound();
    }

    const [userPermissions, allPermissionsResponse, accountType] = await Promise.all([
        getPermissions(id),
        getMasterPermissions("", 1, 9999), // Fetch all permissions
        getAccountType(id),
    ]);

    // Filter permissions to only show those intended for the user's account type, plus root permissions.
    const assignablePermissions = allPermissionsResponse.permissions.filter(p => {
        if (p.intended_for === 'root') return true;
        return p.intended_for === accountType;
    });
    
    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/accounts/${id}`} />
            <PrimaryHeader
                title="Manage User Permissions"
                description={`Assign or restrict permission sets for @${userDetails.neupId}.`}
            />
            <PermissionEditor 
                accountId={id}
                allPermissionSets={assignablePermissions}
                initialAssignedSetIds={userPermissions.assignedPermissionSetIds}
                initialRestrictedSetIds={userPermissions.restrictedPermissionSetIds}
            />
        </div>
    );
}

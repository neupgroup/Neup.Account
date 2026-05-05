import { notFound } from "next/navigation";
import { getPermissions, getUserDetails } from "@/services/manage/users";
import { getMasterPermissions } from "@/services/manage/access/index";
import { BackButton } from "@/components/ui/back-button";
import { PermissionEditor } from "./form";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function UserPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userDetails = await getUserDetails(id);
    if (!userDetails) {
        notFound();
    }

    const [userPermissions, allPermissions] = await Promise.all([
        getPermissions(id),
        getMasterPermissions(),
    ]);

    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/${id}`} />
            <PrimaryHeader
                title="Manage User Permissions"
                description={`Assign or restrict permission sets for @${userDetails.neupId}.`}
            />
            <PermissionEditor
                accountId={id}
                allPermissions={allPermissions}
                initialAssignedPermissions={userPermissions.assignedPermissions}
                initialRestrictedPermissions={userPermissions.restrictedPermissions}
            />
        </div>
    );
}

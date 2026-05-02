
import { notFound } from "next/navigation";
import { getPermissions, getUserDetails } from "@/services/manage/users";
import { getAccountType } from '@/services/user';
import { getMasterPermissions } from "@/services/manage/access/index";
import { PERMISSION_METADATA } from "@/services/permissions";
import { BackButton } from "@/components/ui/back-button";
import { PermissionEditor } from "./form";
import { PrimaryHeader } from "@/components/ui/primary-header";

export default async function UserPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userDetails = await getUserDetails(id);
    if (!userDetails) {
        notFound();
    }

    const [userPermissions, allPermissions, accountType] = await Promise.all([
        getPermissions(id),
        getMasterPermissions(), // Fetch all permissions from permissions.ts
        getAccountType(id),
    ]);

    // Filter permissions based on account type using metadata
    const assignablePermissions = allPermissions.filter(p => {
        const metadata = PERMISSION_METADATA[p.id];
        if (!metadata) return true; // Show if no metadata defined
        return metadata.intended_for.includes(accountType || 'individual');
    });
    
    return (
        <div className="grid gap-8">
            <BackButton href={`/manage/${id}`} />
            <PrimaryHeader
                title="Manage User Permissions"
                description={`Assign or restrict permission sets for @${userDetails.neupId}.`}
            />
            <PermissionEditor 
                accountId={id}
                allPermissions={assignablePermissions}
                initialAssignedPermissions={userPermissions.assignedPermissions}
                initialRestrictedPermissions={userPermissions.restrictedPermissions}
            />
        </div>
    );
}

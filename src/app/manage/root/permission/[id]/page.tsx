
import { notFound } from "next/navigation";
import { getPermissionSetDetails } from "@/actions/root/permission";
import { PermissionForm } from "./form";
import { BackButton } from "@/components/ui/back-button";

export default async function PermissionDetailsPage({ params }: { params: { id: string } }) {
    const permission = await getPermissionSetDetails(params.id);

    if (!permission) {
        notFound();
    }

    return (
        <div className="grid gap-6">
            <BackButton href="/manage/root/permission" />
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                {permission.name}
                </h1>
                <p className="text-muted-foreground font-mono text-sm">
                    ID: {permission.id}
                </p>
            </div>
            <PermissionForm permission={permission} />
        </div>
    );
}

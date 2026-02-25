
import { BackButton } from "@/components/ui/back-button";
import { BulkImportForm } from "./form";
import { checkPermissions } from "@/lib/user";
import { notFound } from "next/navigation";

export default async function BulkImportPage() {
    const canImport = await checkPermissions(['root.permission.bulk_import']);
    if (!canImport) {
        notFound();
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/permission" />
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Bulk Import Permission Sets</h1>
                <p className="text-muted-foreground">
                    Add multiple permission sets for an application using a JSON structure.
                </p>
            </div>
            <BulkImportForm />
        </div>
    )
}

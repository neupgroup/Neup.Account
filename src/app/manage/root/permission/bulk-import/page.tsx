
import { BackButton } from "@/components/ui/back-button";
import { BulkImportForm } from "./form";

export default function BulkImportPage() {
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/permission" />
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

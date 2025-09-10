import { getPaymentDetails } from "@/actions/root/site/payment/actions";
import { PaymentDetailsForm } from "./form";
import { checkPermissions } from "@/lib/user";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";

export default async function PaymentDetailsPage() {
    const canView = await checkPermissions(['root.payment_config.view']);
    if (!canView) {
        notFound();
    }
    
    const initialDetails = await getPaymentDetails();

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Payment Configuration</h1>
                <p className="text-muted-foreground">
                    Configure the payment instructions for users purchasing Neup.Pro.
                </p>
            </div>
            <PaymentDetailsForm initialDetails={initialDetails} />
        </div>
    );
}

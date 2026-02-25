

"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { updatePaymentDetails, type PaymentDetails } from "@/actions/manage/site/payment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import Image from "next/image";

const paymentDetailsSchema = z.object({
    qrCodeUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
    bankDetails: z.string().optional(),
    whatsappContact: z.string().optional(),
    instagramContact: z.string().optional(),
    linkedinContact: z.string().url("Please enter a valid LinkedIn URL.").optional().or(z.literal('')),
});

type FormValues = z.infer<typeof paymentDetailsSchema>;

export function PaymentDetailsForm({ initialDetails }: { initialDetails: PaymentDetails | null }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(paymentDetailsSchema),
        defaultValues: {
            qrCodeUrl: initialDetails?.qrCodeUrl || "",
            bankDetails: initialDetails?.bankDetails || "",
            whatsappContact: initialDetails?.whatsappContact || "",
            instagramContact: initialDetails?.instagramContact || "",
            linkedinContact: initialDetails?.linkedinContact || "",
        },
    });
    
    const qrCodeUrl = useWatch({
        control: form.control,
        name: 'qrCodeUrl'
    });

    const onSubmit = (data: FormValues) => {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value) {
                formData.append(key, value);
            }
        });

        startTransition(async () => {
            const result = await updatePaymentDetails(formData);
            if (result.success) {
                toast({ title: "Success", description: result.message, className: "bg-accent text-accent-foreground" });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error || "An unknown error occurred." });
            }
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                        <CardDescription>Enter the details that will be displayed to users on the purchase page.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <h3 className="font-semibold text-lg">Payment Methods</h3>
                             <div className="grid md:grid-cols-2 gap-6 items-start">
                                <FormField
                                    control={form.control}
                                    name="qrCodeUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>QR Code Image URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://example.com/qr.png" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            {qrCodeUrl && (
                                                <div className="pt-2">
                                                    <Image src={qrCodeUrl} alt="QR Code Preview" width={150} height={150} className="rounded-md border" />
                                                </div>
                                            )}
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bankDetails"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bank Details</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Bank Name: ...&#10;Account Number: ...&#10;Account Name: ..." {...field} rows={5} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                             </div>
                        </div>
                        <div className="space-y-2">
                             <h3 className="font-semibold text-lg">Contact Information</h3>
                              <div className="grid md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="whatsappContact"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>WhatsApp Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+1234567890" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="instagramContact"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Instagram Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="username" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="linkedinContact"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>LinkedIn Profile URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://linkedin.com/in/username" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                              </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Details
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}

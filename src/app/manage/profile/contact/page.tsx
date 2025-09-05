
"use client"

import { useEffect, useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { getUserContacts } from "@/lib/user"
import { updateUserProfile } from "@/actions/profile"
import { useToast } from "@/hooks/use-toast"

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useSession } from '@/context/session-context'
import { BackButton } from '@/components/ui/back-button'

const contactFormSchema = z.object({
  primaryPhone: z.string().optional(),
  secondaryPhone: z.string().optional(),
  permanentLocation: z.string().optional(),
  currentLocation: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { accountId } = useSession();

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactFormSchema),
        defaultValues: {
            primaryPhone: "",
            secondaryPhone: "",
            permanentLocation: "",
            currentLocation: "",
        },
    });

    useEffect(() => {
        if (accountId) {
            const fetchData = async () => {
                const contactsData = await getUserContacts(accountId);
                form.reset({
                    primaryPhone: contactsData.primaryPhone || "",
                    secondaryPhone: contactsData.secondaryPhone || "",
                    permanentLocation: contactsData.permanentLocation || "",
                    currentLocation: contactsData.currentLocation || "",
                });
                setLoading(false);
            }
            fetchData();
        }
    }, [accountId, form]);

    async function onSubmit(data: ContactFormValues) {
        if (!accountId) {
            toast({ variant: "destructive", title: "Error", description: "Not authenticated." });
            return;
        }

        const result = await updateUserProfile(accountId, data);

        if (result.success) {
            toast({ title: "Success", description: "Contact information updated successfully.", className: "bg-accent text-accent-foreground" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    }
    
    if (loading) {
        return <Skeleton className="h-64 w-full" />
    }

    return (
        <div className="space-y-8">
            <BackButton href="/manage/profile" />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                            <CardDescription>Manage your phone numbers and addresses.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="primaryPhone" render={({ field }) => ( <FormItem><FormLabel>Primary Phone</FormLabel><FormControl><Input value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="secondaryPhone" render={({ field }) => ( <FormItem><FormLabel>Secondary Phone</FormLabel><FormControl><Input value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="permanentLocation" render={({ field }) => ( <FormItem><FormLabel>Permanent Location</FormLabel><FormControl><Input value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="currentLocation" render={({ field }) => ( <FormItem><FormLabel>Current Location</FormLabel><FormControl><Input value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </CardContent>
                    </Card>
                     <div className="flex justify-end">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
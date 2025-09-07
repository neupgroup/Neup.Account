
"use client"

import { useEffect, useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { getUserContacts, getUserNeupIds } from "@/lib/user"
import { updateUserProfile } from "@/actions/profile"
import { useToast } from "@/hooks/use-toast"

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { BackButton } from '@/components/ui/back-button'
import { PrimaryHeader } from '@/components/ui/primary-header'

const contactFormSchema = z.object({
  primaryPhone: z.string().optional(),
  secondaryPhone: z.string().optional(),
  permanentLocation: z.string().optional(),
  currentLocation: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function RootUserContactPage({ params }: { params: { id: string } }) {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [userNeupId, setUserNeupId] = useState('');

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
        const fetchData = async () => {
            const [contactsData, neupIds] = await Promise.all([
                getUserContacts(params.id),
                getUserNeupIds(params.id)
            ]);
            setUserNeupId(neupIds[0] || params.id);
            form.reset({
                primaryPhone: contactsData.primaryPhone || "",
                secondaryPhone: contactsData.secondaryPhone || "",
                permanentLocation: contactsData.permanentLocation || "",
                currentLocation: contactsData.currentLocation || "",
            });
            setLoading(false);
        }
        fetchData();
    }, [params.id, form]);

    async function onSubmit(data: ContactFormValues) {
        const result = await updateUserProfile(params.id, data);
        if (result.success) {
            toast({ title: "Success", description: "Contact information updated.", className: "bg-accent text-accent-foreground" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    }
    
    if (loading) {
        return <Skeleton className="h-64 w-full" />
    }

    return (
        <div className="space-y-8">
            <BackButton href={`/manage/root/accounts/${params.id}/profile`} />
            <PrimaryHeader
                title="Contact Information"
                description={`Manage phone numbers and addresses for @${userNeupId}.`}
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Details</CardTitle>
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


"use client"

import { useEffect, useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { getUserProfile } from "@/lib/user"
import { updateUserProfile } from "@/actions/profile"
import { useToast } from "@/hooks/use-toast"

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { BackButton } from '@/components/ui/back-button'
import { PrimaryHeader } from '@/components/ui/primary-header'


const nameFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
});

type NameFormValues = z.infer<typeof nameFormSchema>;

export default function RootUserNamePage({ params }: { params: { id: string } }) {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [profile, setProfile] = useState<any>(null);

    const form = useForm<NameFormValues>({
        resolver: zodResolver(nameFormSchema),
        defaultValues: {
            firstName: "",
            middleName: "",
            lastName: "",
        },
    });

    useEffect(() => {
        const fetchData = async () => {
            const profileData = await getUserProfile(params.id);
            if(profileData) {
                setProfile(profileData);
                form.reset({
                    firstName: profileData.firstName || "",
                    middleName: profileData.middleName || "",
                    lastName: profileData.lastName || "",
                });
            }
            setLoading(false);
        }
        fetchData();
    }, [params.id, form]);

    async function onSubmit(data: NameFormValues) {
        const result = await updateUserProfile(params.id, data);
        if (result.success) {
            toast({ title: "Success", description: "Name updated successfully.", className: "bg-accent text-accent-foreground" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    }

    if (loading) {
        return <Skeleton className="h-64 w-full" />
    }
    
     if (!profile) {
        return <p>User profile not found.</p>
    }

    return (
         <div className="space-y-8">
            <BackButton href={`/manage/root/accounts/${params.id}/profile`} />
             <PrimaryHeader
                title="Legal Name"
                description={`Update the legal name for @${profile.neupId}.`}
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Legal Name</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name</FormLabel><FormControl><Input value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
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

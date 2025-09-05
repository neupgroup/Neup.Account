
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
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getPersonalAccountId } from '@/lib/auth-actions'
import { BackButton } from '@/components/ui/back-button'
import { useSession } from '@/context/session-context'

const displayFormSchema = z.object({
  displayName: z.string().optional(),
  displayPhoto: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
});

type DisplayFormValues = z.infer<typeof displayFormSchema>;

export default function DisplayInfoPage() {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { profile, accountId } = useSession();

    const form = useForm<DisplayFormValues>({
        resolver: zodResolver(displayFormSchema),
        defaultValues: {
            displayName: "",
            displayPhoto: "",
        },
    });

    useEffect(() => {
        if (profile) {
            form.reset({
                displayName: profile.displayName || "",
                displayPhoto: profile.displayPhoto || "",
            });
            setLoading(false);
        }
    }, [profile, form]);

    async function onSubmit(data: DisplayFormValues) {
        if (!accountId) {
            toast({ variant: "destructive", title: "Error", description: "Not authenticated." });
            return;
        }

        const currentProfile = await getUserProfile(accountId);
        if (!currentProfile) {
             toast({ variant: "destructive", title: "Error", description: "Could not load profile." });
            return;
        }

        const result = await updateUserProfile(accountId, { ...currentProfile, ...data });

        if (result.success) {
            toast({ title: "Success", description: "Display information updated successfully.", className: "bg-accent text-accent-foreground" });
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
                            <CardTitle>Display Information</CardTitle>
                            <CardDescription>This information will be displayed publicly on your profile.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center gap-6">
                                <div className="flex-shrink-0">
                                    <Label>Photo</Label>
                                    <Avatar className="h-24 w-24 mt-2 rounded-lg">
                                        <AvatarImage src={form.watch('displayPhoto') || undefined} alt="Display Photo" data-ai-hint="person" />
                                        <AvatarFallback className="rounded-lg">
                                            {`${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="flex-grow space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="displayName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Display Name</FormLabel>
                                                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="displayPhoto"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Photo URL</FormLabel>
                                                <FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
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
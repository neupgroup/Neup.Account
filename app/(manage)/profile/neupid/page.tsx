
"use client"

import { useEffect, useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { getUserNeupIds, getUserProfile } from "@/lib/user"
import { updateUserProfile } from "@/services/profile"
import { useToast } from "@/core/hooks/use-toast"

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/core/providers/session-context'
import { BackButton } from '@/components/ui/back-button'


const neupidFormSchema = z.object({
  newNeupIdRequest: z.string().optional(),
});

type NeupidFormValues = z.infer<typeof neupidFormSchema>;

export default function NeupidPage() {
    const [neupIds, setNeupIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { accountId } = useSession();
    const [isPro, setIsPro] = useState(false);

    const form = useForm<NeupidFormValues>({
        resolver: zodResolver(neupidFormSchema),
        defaultValues: { newNeupIdRequest: "" },
    });

    useEffect(() => {
        if (!accountId) return;

        const fetchData = async () => {
            const [neupIdsData, profile] = await Promise.all([
                getUserNeupIds(accountId),
                getUserProfile(accountId),
            ]);

            setNeupIds(neupIdsData);
            if (profile) {
                setIsPro(profile.pro === true);
            }
            setLoading(false);
        }

        fetchData();
    }, [accountId]);

    async function onSubmit(data: NeupidFormValues) {
        if (!accountId) {
            toast({ variant: "destructive", title: "Error", description: "Not authenticated." });
            return;
        }
        
        const result = await updateUserProfile(accountId, {}, data.newNeupIdRequest);

        if (result.success) {
            toast({ title: "Success", description: "NeupID request sent successfully.", className: "bg-accent text-accent-foreground" });
            form.reset({ newNeupIdRequest: "" });
            if (data.newNeupIdRequest) {
                setNeupIds(prev => [...prev, `${data.newNeupIdRequest} (pending)`])
            }
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    }
    
    const neupIdLimit = isPro ? 2 : 1;
    const canRequestNeupId = neupIds.length < neupIdLimit;

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
                            <CardTitle>NeupID and Identities</CardTitle>
                            <CardDescription>Manage your unique identifiers and request new ones.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Associated NeupIDs</Label>
                                <div className="flex flex-wrap gap-2">
                                    {neupIds.map((id) => (
                                        <Badge key={id} variant="secondary">{id}</Badge>
                                    ))}
                                </div>
                            </div>
                            {canRequestNeupId ? (
                                <FormField control={form.control} name="newNeupIdRequest" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Request New NeupID</FormLabel>
                                        <FormControl><Input placeholder="Enter desired NeupID" value={field.value ?? ''} onChange={field.onChange} /></FormControl>
                                        <FormDescription>Your request will be sent for admin approval. You can request up to {neupIdLimit} NeupIDs.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            ) : (
                                <FormItem>
                                    <FormLabel>Request New NeupID</FormLabel>
                                    <FormControl><Input placeholder="You have reached your NeupID limit" disabled /></FormControl>
                                    <FormDescription>Upgrade to Pro to request more NeupIDs, or contact an administrator.</FormDescription>
                                </FormItem>
                            )}
                        </CardContent>
                    </Card>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={form.formState.isSubmitting || !canRequestNeupId}>
                            {form.formState.isSubmitting ? "Sending Request..." : "Request NeupID"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
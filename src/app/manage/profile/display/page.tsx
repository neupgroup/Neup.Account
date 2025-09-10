
"use client"

import { useEffect, useState, useTransition } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { updateUserProfile, getDisplayNameSuggestions } from "@/actions/profile"
import { useToast } from "@/hooks/use-toast"

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useSession } from '@/context/session-context'
import { BackButton } from '@/components/ui/back-button'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from '@/components/icons'

const displayFormSchema = z.object({
  displayPhoto: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  selectedDisplayName: z.string().min(1, "Please select a display name format."),
  customDisplayName: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.selectedDisplayName === 'custom' && (!data.customDisplayName || data.customDisplayName.length < 3)) {
        ctx.addIssue({
            code: "custom",
            path: ["customDisplayName"],
            message: "Custom display name must be at least 3 characters.",
        });
    }
});

type DisplayFormValues = z.infer<typeof displayFormSchema>;

export default function DisplayInfoPage() {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { profile, accountId } = useSession();
    const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    const form = useForm<DisplayFormValues>({
        resolver: zodResolver(displayFormSchema),
        defaultValues: {
            displayPhoto: "",
            selectedDisplayName: "",
            customDisplayName: "",
        },
    });

    useEffect(() => {
        if (profile) {
            form.reset({
                displayPhoto: profile.displayPhoto || "",
                selectedDisplayName: profile.displayName || "",
            });

            const fetchSuggestions = async () => {
                if (accountId) {
                    const suggestions = await getDisplayNameSuggestions(accountId);
                    setNameSuggestions(suggestions);
                }
                setLoading(false);
            }
            fetchSuggestions();
        }
    }, [profile, accountId, form]);

    async function onSubmit(data: DisplayFormValues) {
        if (!accountId) {
            toast({ variant: "destructive", title: "Error", description: "Not authenticated." });
            return;
        }

        startTransition(async () => {
             const result = await updateUserProfile(accountId, { 
                displayPhoto: data.displayPhoto,
                displayName: data.selectedDisplayName === 'custom' ? undefined : data.selectedDisplayName,
                customDisplayNameRequest: data.selectedDisplayName === 'custom' ? data.customDisplayName : undefined,
             });

            if (result.success) {
                toast({ title: "Success", description: result.message, className: "bg-accent text-accent-foreground" });
                if(data.selectedDisplayName === 'custom') {
                    form.setValue('customDisplayName', '');
                }
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    }
    
    const selectedDisplayName = form.watch('selectedDisplayName');

    if (loading) {
        return <Skeleton className="h-96 w-full" />
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
                        <CardContent className="space-y-6">
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
                                <div className="flex-grow">
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
                            
                            <FormField
                                control={form.control}
                                name="selectedDisplayName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Display Name Format</FormLabel>
                                        <FormControl>
                                            <div className="flex flex-wrap gap-2">
                                                {nameSuggestions.map(name => (
                                                    <Button key={name} type="button" variant={field.value === name ? "default" : "secondary"} onClick={() => field.onChange(name)} className="relative">
                                                        {field.value === name && <Check className="absolute -left-1 -top-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                                                        {name}
                                                    </Button>
                                                ))}
                                                 <Button type="button" variant={field.value === 'custom' ? "default" : "secondary"} onClick={() => field.onChange('custom')} className="relative">
                                                    {field.value === 'custom' && <Check className="absolute -left-1 -top-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                                                    Custom...
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                             {selectedDisplayName === 'custom' && (
                                <FormField
                                    control={form.control}
                                    name="customDisplayName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Custom Display Name</FormLabel>
                                            <FormControl><Input {...field} placeholder="Enter your custom display name" /></FormControl>
                                            <FormDescription>Your request will be sent for review.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </CardContent>
                    </Card>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

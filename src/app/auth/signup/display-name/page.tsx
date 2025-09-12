
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import NProgress from 'nprogress';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

import { useToast } from "@/hooks/use-toast";
import { submitDisplayNameStep, getSignupStepData } from "@/actions/auth/signup";
import { getDisplayNameSuggestions } from "@/actions/profile";
import { displayNameSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Check, Loader2 } from "@/components/icons";

type FormData = z.infer<typeof displayNameSchema>;

export default function DisplayNameStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const form = useForm<FormData>({
        resolver: zodResolver(displayNameSchema),
    });

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const { data } = await getSignupStepData();
            if (data && data.nameFirst) {
                // Assuming getDisplayNameSuggestions can work with the partial data
                const suggestions = await getDisplayNameSuggestions({
                    nameFirst: data.nameFirst,
                    nameMiddle: data.nameMiddle,
                    nameLast: data.nameLast
                });
                setNameSuggestions(suggestions);
                form.setValue("displayName", data.nameDisplay || suggestions[0] || `${data.nameFirst} ${data.nameLast}`.trim());
            }
            setLoading(false);
        }
        loadData();
    }, [form]);

    const onSubmit = async (data: FormData) => {
        NProgress.start();
        const result = await submitDisplayNameStep(data);
        if (result.success) {
            router.push('/auth/signup/demographics');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            NProgress.done();
        }
    }

    const isSubmitting = form.formState.isSubmitting;
    const selectedDisplayName = form.watch('displayName');

    if (loading) {
        return <div className="h-48 animate-pulse rounded-md bg-muted" />;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Choose how your name is displayed</FormLabel>
                            <FormControl>
                                <div className="flex flex-wrap gap-2">
                                    {nameSuggestions.map(name => (
                                        <Button key={name} type="button" variant={field.value === name ? "default" : "secondary"} onClick={() => field.onChange(name)} className="relative">
                                            {field.value === name && <Check className="absolute -left-1 -top-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                                            {name}
                                        </Button>
                                    ))}
                                    {/* Custom option disabled during signup for simplicity */}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Next
                </Button>
            </form>
        </Form>
    );
}

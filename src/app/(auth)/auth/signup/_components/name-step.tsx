'use client';

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitNameStep, getSignupStepData } from "@/actions/auth/signup";
import { initializeAuthFlow } from "@/actions/auth/initialize";
import { nameSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type FormData = z.infer<typeof nameSchema>;

export function NameStep() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [showMiddleName, setShowMiddleName] = useState(false);
    const [authRequestId, setAuthRequestId] = useState<string | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(nameSchema),
        defaultValues: {
            firstName: "",
            middleName: "",
            lastName: "",
        },
    });

    useEffect(() => {
        const initFlow = async () => {
            let id = sessionStorage.getItem('temp_auth_id');

            if (!id) {
                try {
                    id = await initializeAuthFlow(null, 'signup');
                    sessionStorage.setItem('temp_auth_id', id);
                    setAuthRequestId(id);
                } catch (error) {
                    console.error("Failed to initialize signup flow", error);
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to initialize session. Please refresh.' });
                    return;
                }
            } else {
                setAuthRequestId(id);
                async function loadData() {
                    const { data } = await getSignupStepData(id!);
                    if (data) {
                        form.reset({
                            firstName: data.nameFirst || "",
                            middleName: data.nameMiddle || "",
                            lastName: data.nameLast || "",
                        });
                        if (data.nameMiddle) {
                            setShowMiddleName(true);
                        }
                    }
                }
                loadData();
            }
        };
        initFlow();
    }, [router, form, toast]);

    const onSubmit = async (data: FormData) => {
        const currentId = authRequestId || sessionStorage.getItem('temp_auth_id');
        if (!currentId) {
            toast({ title: 'Please wait...', description: 'Initializing secure session.' });
            return;
        }

        NProgress.start();
        const result = await submitNameStep(currentId, data);
        if (result.success) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('step', 'demographics');
            router.push(`/auth/signup?${params.toString()}`);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            NProgress.done();
        }
    }

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                {!showMiddleName && (
                    <div className="flex items-center space-x-2">
                        <Checkbox id="hasMiddleName" onCheckedChange={(checked) => setShowMiddleName(!!checked)} disabled={isSubmitting} />
                        <Label htmlFor="hasMiddleName" className="font-normal cursor-pointer">I have a middle name</Label>
                    </div>
                )}

                {showMiddleName && (
                    <FormField control={form.control} name="middleName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Middle Name</FormLabel>
                            <FormControl><Input {...field} disabled={isSubmitting} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}

                <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Next
                </Button>
            </form>
        </Form>
    );
}

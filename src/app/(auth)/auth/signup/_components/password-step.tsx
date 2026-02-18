'use client';

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitPasswordStep } from "@/actions/auth/signup";
import { passwordSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/icons";

type FormData = z.infer<typeof passwordSchema>;

export function PasswordStep() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [authRequestId, setAuthRequestId] = useState<string | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            password: "",
        },
    });

    useEffect(() => {
        const id = sessionStorage.getItem('temp_auth_id');
        if (!id) {
            router.push('/auth/signup');
            return;
        }
        setAuthRequestId(id);
    }, [router]);

    const onSubmit = async (data: FormData) => {
        if (!authRequestId) return;
        NProgress.start();
        const result = await submitPasswordStep(authRequestId, data);
        if (result.success) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('step', 'terms');
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
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Create a Password</FormLabel>
                        <FormControl><Input type="password" {...field} autoComplete="new-password" /></FormControl>
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

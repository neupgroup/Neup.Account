'use client';

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitOtpStep } from "@/actions/auth/signup";
import { otpSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/icons";

type FormData = z.infer<typeof otpSchema>;

export default function OtpStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [authRequestId, setAuthRequestId] = useState<string | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: {
            code: "",
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
        const result = await submitOtpStep(authRequestId, data);
        if (result.success) {
            router.push('/auth/signup/neupid');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            NProgress.done();
        }
    }

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl><Input {...field} maxLength={6} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify and Continue
                </Button>
            </form>
        </Form>
    );
}

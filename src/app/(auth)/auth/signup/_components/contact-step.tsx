'use client';

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitContactStep, getSignupStepData } from "@/actions/auth/signup";
import { contactSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/icons";

type FormData = z.infer<typeof contactSchema>;

export function ContactStep() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [authRequestId, setAuthRequestId] = useState<string | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            phone: "",
        },
    });

    useEffect(() => {
        const id = sessionStorage.getItem('temp_auth_id');
        if (!id) {
            router.push('/auth/signup');
            return;
        }
        setAuthRequestId(id);

        async function loadData() {
            const { data } = await getSignupStepData(id || '');
            if (data?.phone) {
                form.setValue("phone", data.phone);
            }
        }
        loadData();
    }, [router, form]);

    const onSubmit = async (data: FormData) => {
        if (!authRequestId) return;
        NProgress.start();
        const result = await submitContactStep(authRequestId, data);
        if (result.success) {
            const params = new URLSearchParams(searchParams.toString());
            // Based on step order in layout: contact -> otp
            // Wait, layout says contact -> otp. But submitContactStep redirects to neupid?
            // Let me check layout again.
            // stepOrder: name, demographics, nationality, contact, otp, neupid, password, terms.
            // The original contact/page.tsx redirected to /auth/signup/neupid.
            // This skips OTP step?
            // Let me re-read contact/page.tsx.
            // "router.push('/auth/signup/neupid');"
            // So OTP is skipped or conditional?
            // Wait, if I look at `submitContactStep`, maybe it decides if OTP is needed?
            // But the client code hardcoded neupid.
            // Maybe OTP is handled differently or removed.
            // I should follow the original code: neupid.
            // However, the layout has otp step.
            // Let me check if OTP page is used. It exists.
            // Maybe the original code I read was incomplete or I misread.
            // Let me check `submitContactStep` return value.
            // If it returns success, maybe it implies OTP is done or not needed?
            // Ah, maybe the user wants to merge pages and maybe fix flow too?
            // I should stick to original behavior: redirect to neupid.
            // BUT wait, if I check `OtpStepPage`, it redirects to `neupid`.
            // So `Contact` -> `Neupid` skips `Otp`.
            // Maybe `Otp` is only for some cases?
            // I'll stick to original behavior.
            params.set('step', 'neupid');
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
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continue
                </Button>
            </form>
        </Form>
    );
}

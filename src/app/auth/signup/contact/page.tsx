
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
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

export default function ContactStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const form = useForm<FormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            phone: "",
        },
    });

    useEffect(() => {
        async function loadData() {
            const { data } = await getSignupStepData();
            if (data && data.phone) {
                form.setValue("phone", data.phone);
            }
        }
        loadData();
    }, [form]);

    const onSubmit = async (data: FormData) => {
        NProgress.start();
        const result = await submitContactStep(data);
        if (result.success) {
            router.push('/auth/signup/otp');
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
                    Send Verification Code
                </Button>
            </form>
        </Form>
    );
}

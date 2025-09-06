"use client"

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitNameStep, getSignupStepData } from "@/actions/auth/signup";
import { nameSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/icons";

type FormData = z.infer<typeof nameSchema>;

export default function NameStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const form = useForm<FormData>({
        resolver: zodResolver(nameSchema),
        defaultValues: {
            firstName: "",
            middleName: "",
            lastName: "",
        },
    });

    useEffect(() => {
        async function loadData() {
            const { data } = await getSignupStepData();
            if (data) {
                form.reset({
                    firstName: data.firstName || "",
                    middleName: data.middleName || "",
                    lastName: data.lastName || "",
                });
            }
        }
        loadData();
    }, [form]);

    const onSubmit = async (data: FormData) => {
        NProgress.start();
        const result = await submitNameStep(data);
        if (result.success) {
            router.push('/auth/signup/demographics');
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
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="middleName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Middle Name (Optional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
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

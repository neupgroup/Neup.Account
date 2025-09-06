
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitNationalityStep, getSignupStepData } from "@/actions/auth/signup";
import { nationalitySchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "@/components/icons";
import { countries } from "./countries";

type FormData = z.infer<typeof nationalitySchema>;

export default function NationalityStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const form = useForm<FormData>({
        resolver: zodResolver(nationalitySchema),
    });

    useEffect(() => {
        async function loadData() {
            const { data } = await getSignupStepData();
            if (data && data.nationality) {
                form.setValue("nationality", data.nationality);
            }
        }
        loadData();
    }, [form]);

    const onSubmit = async (data: FormData) => {
        NProgress.start();
        const result = await submitNationalityStep(data);
        if (result.success) {
            router.push('/auth/signup/contact');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            NProgress.done();
        }
    }

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your country" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {countries.map(country => (
                                        <SelectItem key={country.code} value={country.name}>
                                            {country.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

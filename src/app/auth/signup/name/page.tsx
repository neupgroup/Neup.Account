
"use client"

import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type FormData = z.infer<typeof nameSchema>;

export default function NameStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [showMiddleName, setShowMiddleName] = useState(false);

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
                if (data.middleName) {
                    setShowMiddleName(true);
                }
            }
        }
        loadData();
    }, [form]);

    const onSubmit = async (data: FormData) => {
        NProgress.start();
        const result = await submitNameStep(data);
        if (result.success) {
            router.push('/auth/signup/display-name');
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

    
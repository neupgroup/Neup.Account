"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';

import { useToast } from "@/hooks/use-toast";
import { submitTermsStep } from "@/actions/auth/signup";
import { termsSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "@/components/icons";

type FormData = z.infer<typeof termsSchema>;

export default function TermsStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const form = useForm<FormData>({
        resolver: zodResolver(termsSchema),
        defaultValues: {
            agreement: false,
        },
    });

    const onSubmit = async (data: FormData) => {
        NProgress.start();
        const result = await submitTermsStep(data);
        if (result.success) {
            router.push('/manage');
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
                    name="agreement"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    I agree to the <Link href="/manage/policies" target="_blank" className="underline text-primary">terms and conditions</Link>.
                                </FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                </Button>
            </form>
        </Form>
    );
}

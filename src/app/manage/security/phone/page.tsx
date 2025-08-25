
"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { phoneFormSchema } from "@/schemas/security";
import { getRecoveryPhone, addRecoveryPhone, removeRecoveryPhone } from "@/actions/security/phone";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

type PhoneFormValues = z.infer<typeof phoneFormSchema>;

export default function RecoveryPhonePage() {
    const [phone, setPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [isSubmitting, startTransition] = useTransition();

    const form = useForm<PhoneFormValues>({
        resolver: zodResolver(phoneFormSchema),
        defaultValues: {
            phone: "",
        },
    });

    const fetchPhone = async () => {
        setLoading(true);
        const phone = await getRecoveryPhone();
        setPhone(phone);
        form.reset({ phone: "" }); // Reset form when fetching
        setLoading(false);
    };

    useEffect(() => {
        fetchPhone();
    }, []);

    const handleAdd = async (data: PhoneFormValues) => {
        startTransition(async () => {
            const result = await addRecoveryPhone(data);
            if (result.success) {
                toast({ title: "Success", description: "Recovery phone added.", className: "bg-accent text-accent-foreground" });
                await fetchPhone();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    };
    
    const handleRemove = async () => {
         startTransition(async () => {
            const result = await removeRecoveryPhone();
            if (result.success) {
                toast({ title: "Success", description: "Recovery phone removed." });
                await fetchPhone();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/security" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Recovery Phone</h1>
                <p className="text-muted-foreground">
                    This number can be used to help you get back into your account if you're locked out.
                </p>
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Manage Phone Number</h2>
                 <p className="text-muted-foreground text-sm">
                    We will only use this number for account recovery purposes.
                </p>
                <Card>
                    <CardContent className="pt-6">
                        {loading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : phone ? (
                            <div className="flex items-center justify-between rounded-md border border-input bg-background p-3">
                                <p className="font-mono text-sm">{phone}</p>
                                <Button variant="ghost" size="icon" onClick={handleRemove} disabled={isSubmitting} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                     {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        ) : (
                             <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleAdd)} className="flex items-start gap-2">
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormLabel className="sr-only">Phone Number</FormLabel>
                                                <FormControl>
                                                    <Input type="tel" placeholder="Enter new recovery phone" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" disabled={isSubmitting} size="icon" className="flex-shrink-0">
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        <span className="sr-only">Add Phone Number</span>
                                    </Button>
                                </form>
                            </Form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

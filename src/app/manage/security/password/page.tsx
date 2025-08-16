
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { changePasswordSchema } from "./schema";
import { changePassword } from "./actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState, useContext } from "react";
import { BackButton } from "@/components/ui/back-button";
import { GeolocationContext } from "@/context/geolocation-context";

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const geo = useContext(GeolocationContext);

    const form = useForm<ChangePasswordFormValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
        },
    });

    async function onSubmit(data: ChangePasswordFormValues) {
        setIsSubmitting(true);
        const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;
        const result = await changePassword(data, locationString);

        if (result.success) {
            toast({ title: "Success", description: result.message, className: "bg-accent text-accent-foreground" });
            form.reset();
        } else {
             let description = result.error;
            if (result.details) {
                description = Object.values(result.details.fieldErrors).flat().join(' | ');
            }
            toast({ variant: "destructive", title: "Error", description: description || "An error occurred." });
        }
        setIsSubmitting(false);
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/security" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Change Password</h1>
                <p className="text-muted-foreground">
                    Choose a strong, new password that you don&apos;t use for other accounts.
                </p>
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Update Password</h2>
                 <p className="text-muted-foreground text-sm">
                    Enter your current password and a new password to update your account.
                </p>
                <Card>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardContent className="space-y-4 pt-6">
                                <FormField
                                    control={form.control}
                                    name="currentPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Current Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>New Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Updating..." : "Update Password"}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
            </div>
        </div>
    );
}

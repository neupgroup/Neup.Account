
"use client";

import { useRef, useTransition, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addApp } from '../actions';
import crypto from 'crypto';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { BackButton } from '@/components/ui/back-button';
import { Loader2 } from 'lucide-react';
import { checkPermissions } from '@/lib/user-actions';

const addAppSchema = z.object({
    id: z.string().min(3, { message: "App ID must be at least 3 characters." }),
    name: z.string().min(3, { message: "App name must be at least 3 characters." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

type FormValues = z.infer<typeof addAppSchema>;

export default function CreateAppPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [canCreate, setCanCreate] = useState(false);

    useEffect(() => {
        const verifyPermission = async () => {
            const hasPerm = await checkPermissions(['root.app.create']);
            setCanCreate(hasPerm);
        };
        verifyPermission();
    }, []);

    const form = useForm<FormValues>({
        resolver: zodResolver(addAppSchema),
        defaultValues: {
            id: '',
            name: '',
            description: '',
        }
    });
    
    const appName = form.watch('name');

    useEffect(() => {
        if (appName) {
            const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const randomId = crypto.randomBytes(3).toString('hex');
            form.setValue('id', `${slug}.${randomId}`, { shouldValidate: true });
        }
    }, [appName, form]);

    const handleFormSubmit = async (data: FormValues) => {
        const formData = new FormData();
        formData.append('id', data.id);
        formData.append('name', data.name);
        formData.append('description', data.description);

        startTransition(async () => {
            const result = await addApp(formData);
            if (result.success) {
                toast({ title: "Success", description: result.message, className: "bg-accent text-accent-foreground" });
                router.push('/manage/root/app');
            } else {
                let description = result.error;
                if (result.details) {
                    description = Object.values(result.details).flat().join(' | ');
                }
                toast({ variant: "destructive", title: "Error", description: description || "An error occurred." });
            }
        });
    };

    if (!canCreate) {
        return (
            <div>
                <BackButton href="/manage/root/app" />
                <p className="mt-4 text-destructive">You do not have permission to create applications.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/app" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Create Application</h1>
                <p className="text-muted-foreground">
                    Register a new application that can integrate with NeupID.
                </p>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Application Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>App Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="My Awesome App" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>App ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="my-awesome-app.a1b2c3d4" {...field} />
                                        </FormControl>
                                         <FormDescription>
                                            A unique, editable identifier for your application.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="A short description of what this application does." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                                Create Application
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}

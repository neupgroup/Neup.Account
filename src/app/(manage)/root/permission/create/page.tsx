"use client";

import { useRef, useTransition, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebounce } from 'use-debounce';
import { addPermission, checkAppIdExists } from '@/actions/root/permission';
import type { Permission } from '@/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BackButton } from '@/components/ui/back-button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


const addPermissionSchema = z.object({
    name: z.string().min(3, { message: "Set name must be at least 3 characters." }),
    app_id: z.string().min(3, { message: "App Slug must be at least 3 characters." }),
    access: z.array(z.string()).min(1, { message: "At least one permission is required." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
    intended_for: z.enum(['individual', 'brand', 'dependent', 'branch', 'root'], {
        required_error: "You must select who this permission is intended for.",
    }),
});

type FormValues = z.infer<typeof addPermissionSchema>;

export default function CreatePermissionPage() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [appIdStatus, setAppIdStatus] = useState<'idle' | 'checking' | 'exists' | 'not_found'>('idle');
    const [recentlyAdded, setRecentlyAdded] = useState<Permission[]>([]);
    const [permissionInput, setPermissionInput] = useState('');



    const form = useForm<FormValues>({
        resolver: zodResolver(addPermissionSchema),
        defaultValues: { name: '', app_id: '', access: [], description: '' }
    });
    
    const { fields, append, remove } = useFieldArray<FormValues>({
        control: form.control,
        name: "access",
    });
    
    const appIdValue = form.watch("app_id");
    const [debouncedAppId] = useDebounce(appIdValue, 500);

    const checkAvailability = useCallback(async (slug: string) => {
        if (slug.length < 3) {
            setAppIdStatus('idle');
            return;
        }
        setAppIdStatus('checking');
        const { exists } = await checkAppIdExists(slug);
        setAppIdStatus(exists ? 'exists' : 'not_found');
    }, []);
    
    useEffect(() => {
        checkAvailability(debouncedAppId);
    }, [debouncedAppId, checkAvailability]);

    const handleAddPermissions = () => {
        const perms = permissionInput.split(',').map(p => p.trim()).filter(p => p);
        if(perms.length === 0) return;

        const currentPermissions = new Set(form.getValues('access'));
        const uniqueNewPerms = perms.filter(p => !currentPermissions.has(p));
        
        uniqueNewPerms.forEach(p => append(p));
        setPermissionInput('');
    }

    const onSubmit = async (data: FormValues) => {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'access' && Array.isArray(value)) {
                value.forEach(p => formData.append('access', p));
            } else if (typeof value === 'string') {
                formData.append(key, value);
            }
        });

        startTransition(async () => {
            const result = await addPermission(formData);
            if (result.success) {
                toast({ title: "Success", description: "Permission set added successfully.", className: "bg-accent text-accent-foreground" });
                if (result.newPermission) {
                    setRecentlyAdded(prev => [result.newPermission!, ...prev]);
                }
                form.reset({ app_id: data.app_id, name: '', access: [], description: '', intended_for: data.intended_for});
                form.setFocus('name');
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error || "An error occurred." });
            }
        });
    };

    const AppIdStatusIcon = () => {
        if (appIdStatus === 'checking') return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
        if (appIdStatus === 'exists') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        if (appIdStatus === 'not_found') return <XCircle className="h-5 w-5 text-destructive" />;
        return null;
    }

    const intendedForOptions = [
        { value: 'individual', label: 'Individual' },
        { value: 'brand', label: 'Brand' },
        { value: 'dependent', label: 'Dependent' },
        { value: 'branch', label: 'Branch' },
        { value: 'root', label: 'Root' }
    ];

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/permission" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Create Permission Set</h1>
                <p className="text-muted-foreground">
                    Define a new reusable set of permissions for an application.
                </p>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card>
                        <CardHeader><CardTitle>Permission Set Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="intended_for" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Intended For</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
                                            >
                                                {intendedForOptions.map(option => (
                                                    <FormItem key={option.value}>
                                                        <RadioGroupItem value={option.value} id={`intended_for_${option.value}`} className="peer sr-only" />
                                                        <Label
                                                            htmlFor={`intended_for_${option.value}`}
                                                            className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover px-3 py-2 text-sm font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                                                        >
                                                            {option.label}
                                                        </Label>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Set Name</FormLabel><FormControl><Input placeholder="e.g., individual.default" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="app_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>App Slug</FormLabel>
                                    <div className="relative">
                                        <FormControl>
                                            <Input placeholder="neup_console" {...field} />
                                        </FormControl>
                                        <div className="absolute inset-y-0 right-3 flex items-center">
                                            <AppIdStatusIcon />
                                        </div>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="access" render={() => (
                                <FormItem>
                                    <FormLabel>Permissions</FormLabel>
                                    <div className="flex gap-2">
                                        <Input
                                            value={permissionInput}
                                            onChange={(e) => setPermissionInput(e.target.value)}
                                            placeholder="user.read, user.write"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddPermissions();
                                                }
                                            }}
                                        />
                                    </div>
                                    <FormDescription>Enter permissions in 'domain.action' format, separated by commas.</FormDescription>
                                    <div className="flex flex-wrap gap-2 border rounded-md p-2 min-h-[40px]">
                                        {fields.map((field, index) => (
                                            <Badge key={field.id} variant="outline" className="text-sm font-normal">
                                                {form.getValues('access')[index]}
                                                <button type="button" onClick={() => remove(index)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Allows reading and writing property data." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isPending || appIdStatus !== 'exists'}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Permission Set
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>

            {recentlyAdded.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">Recently Created</h2>
                    <Card>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {recentlyAdded.map(perm => (
                                    <div key={perm.id} className="p-4">
                                        <p className="font-semibold">{perm.name}</p>
                                        <p className="text-sm text-muted-foreground">{perm.description}</p>
                                        <p className="text-xs font-mono text-muted-foreground mt-1">{perm.app_id}</p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {perm.access.map((a: any) => (
                                                <Badge key={a} variant="secondary">{a}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
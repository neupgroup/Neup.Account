
"use client";

import { useTransition, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebounce } from 'use-debounce';
import { bulkAddPermissions, type BulkAddResult } from '@/actions/root/permission/bulk-import';
import { checkAppIdExists } from '@/actions/root/permission';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle2, XCircle, UploadCloud } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
    app_id: z.string().min(3, "App Slug must be at least 3 characters."),
    intended_for: z.enum(['individual', 'brand', 'dependent', 'branch', 'root'], {
        required_error: "You must select who this permission is intended for.",
    }),
    permissionsJson: z.string().min(1, "Permissions JSON cannot be empty.").refine((val) => {
        try {
            JSON.parse(val);
            return true;
        } catch (e) {
            return false;
        }
    }, "Must be valid JSON."),
});

type FormValues = z.infer<typeof formSchema>;

const jsonTemplate = JSON.stringify([
    {
        "name": "example.Read",
        "permissions": "example.read",
        "description": "Allows reading example resources."
    },
    {
        "name": "example.Write",
        "permissions": "example.write, example.delete",
        "description": "Allows writing and deleting example resources."
    }
], null, 2);

const intendedForOptions = [
    { value: 'individual', label: 'Individual' },
    { value: 'brand', label: 'Brand' },
    { value: 'dependent', label: 'Dependent' },
    { value: 'branch', label: 'Branch' },
    { value: 'root', label: 'Root' }
];

export function BulkImportForm() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [appIdStatus, setAppIdStatus] = useState<'idle' | 'checking' | 'exists' | 'not_found'>('idle');
    const [results, setResults] = useState<BulkAddResult[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { app_id: '', permissionsJson: '' }
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

    const onSubmit = async (data: FormValues) => {
        setResults([]);
        startTransition(async () => {
            const importResults = await bulkAddPermissions(data.app_id, data.intended_for, data.permissionsJson);
            setResults(importResults);
            
            const successCount = importResults.filter(r => r.status === 'success').length;
            if (successCount > 0) {
                 toast({ title: "Import Complete", description: `${successCount} of ${importResults.length} permission sets added.`, className: "bg-accent text-accent-foreground" });
            } else {
                 toast({ variant: "destructive", title: "Import Failed", description: "No permission sets were added. Check the results below." });
            }
        });
    };
    
    const AppIdStatusIcon = () => {
        if (appIdStatus === 'checking') return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
        if (appIdStatus === 'exists') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        if (appIdStatus === 'not_found') return <XCircle className="h-5 w-5 text-destructive" />;
        return null;
    }

    return (
        <div className="grid gap-8">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card>
                        <CardHeader><CardTitle>Bulk Import Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
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
                             <FormField
                                control={form.control}
                                name="permissionsJson"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Permissions JSON</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={jsonTemplate}
                                            rows={15}
                                            {...field}
                                            className="font-mono text-xs"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isPending || appIdStatus !== 'exists'}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                Start Import
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>

             {results.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">Import Results</h2>
                    <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-72">
                                <div className="p-6 divide-y">
                                    {results.map((result, index) => (
                                        <div key={index} className="py-3 first:pt-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                {result.status === 'success' ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                                                )}
                                                <div>
                                                    <p className="font-semibold">{result.name}</p>
                                                    <p className="text-sm text-muted-foreground">{result.message}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

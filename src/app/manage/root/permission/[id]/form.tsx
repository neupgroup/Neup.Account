"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { updatePermissionSet, deletePermissionSet } from '@/actions/root/permission';
import { type Permission, checkPermissionNameExists } from '@/actions/root/permission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useDebounce } from 'use-debounce';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Permission } from '@/types';

const editPermissionSchema = z.object({
    name: z.string().min(3, { message: "Set name must be at least 3 characters." }),
    access: z.array(z.string()).min(1, { message: "At least one permission is required." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

type FormValues = z.infer<typeof editPermissionSchema>;

export function PermissionForm({ permission }: { permission: Permission }) {
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();
    const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
    const [permissionInput, setPermissionInput] = useState('');
    
    const [originalPermissions, setOriginalPermissions] = useState(new Set(permission.access));
    const [newlyAddedPermissions, setNewlyAddedPermissions] = useState(new Set<string>());

    const form = useForm<FormValues>({
        resolver: zodResolver(editPermissionSchema),
        defaultValues: {
            name: permission.name,
            access: permission.access,
            description: permission.description,
        },
    });
    
    const nameValue = form.watch("name");
    const [debouncedName] = useDebounce(nameValue, 500);

    const checkName = useCallback(async (name: string) => {
        if (!name || name.length < 3) {
            setNameStatus('idle');
            return;
        }
        if (name === permission.name) {
            setNameStatus('available');
            return;
        }
        setNameStatus('checking');
        const { exists } = await checkPermissionNameExists(name, permission.id);
        setNameStatus(exists ? 'unavailable' : 'available');
    }, [permission.id, permission.name]);

    useEffect(() => {
        if (isEditing) {
            checkName(debouncedName);
        }
    }, [debouncedName, isEditing, checkName]);

    const handleAddPermissions = () => {
        const perms = permissionInput.split(',').map(p => p.trim()).filter(p => p);
        if (perms.length === 0) return;
        
        const currentPermissions = new Set(form.getValues('access'));
        const newPermissionsToAdd = new Set<string>();
        
        perms.forEach(p => {
            if (!currentPermissions.has(p)) {
                 form.setValue('access', [...currentPermissions, p], { shouldValidate: true });
                 if(!originalPermissions.has(p)) {
                    newPermissionsToAdd.add(p);
                 }
            }
        });
        
        setNewlyAddedPermissions(prev => new Set([...prev, ...newPermissionsToAdd]));
        setPermissionInput('');
    };
    
    const handleRemovePermission = (permToRemove: string) => {
        const currentPermissions = form.getValues('access');
        form.setValue('access', currentPermissions.filter(p => p !== permToRemove), { shouldValidate: true });
        
        const newSet = new Set(newlyAddedPermissions);
        newSet.delete(permToRemove);
        setNewlyAddedPermissions(newSet);
    };

    const onSubmit = (data: FormValues) => {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('description', data.description);
        data.access.forEach(p => formData.append('access', p));

        startTransition(async () => {
            const result = await updatePermissionSet(permission.id, formData);
            if (result.success) {
                toast({ title: "Success", description: "Permission set updated.", className: "bg-accent text-accent-foreground" });
                setIsEditing(false);
                setOriginalPermissions(new Set(data.access));
                setNewlyAddedPermissions(new Set());
                router.refresh();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error || "An unknown error occurred." });
            }
        });
    };

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deletePermissionSet(permission.id);
             if (result.success) {
                toast({ title: "Success", description: "Permission set has been deleted." });
                router.push('/manage/root/permission');
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error || "An unknown error occurred." });
            }
        });
    }
    
    const NameStatusIcon = () => {
        if (nameStatus === 'checking') return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
        if (nameStatus === 'available') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        if (nameStatus === 'unavailable') return <XCircle className="h-5 w-5 text-destructive" />;
        return null;
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Permission Set Details</CardTitle>
                        <CardDescription>View or edit the details for this permission set.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div>
                            <Label>Intended For</Label>
                            <Input value={permission.intended_for.charAt(0).toUpperCase() + permission.intended_for.slice(1)} disabled />
                        </div>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Set Name</FormLabel>
                                <div className="relative">
                                    <FormControl>
                                        <Input {...field} disabled={!isEditing || isPending} className="pr-10" />
                                    </FormControl>
                                    <div className="absolute inset-y-0 right-3 flex items-center">
                                        {isEditing && <NameStatusIcon />}
                                    </div>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <div>
                            <Label>App Slug</Label>
                            <Input value={permission.app_id} disabled />
                        </div>
                        
                         <FormField control={form.control} name="access" render={() => (
                            <FormItem>
                                <FormLabel>Permissions</FormLabel>
                                {isEditing && (
                                     <div className="flex gap-2">
                                        <Input
                                            value={permissionInput}
                                            onChange={(e) => setPermissionInput(e.target.value)}
                                            placeholder="user.read, user.write"
                                            disabled={!isEditing || isPending}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddPermissions();
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                                <div className={cn("flex flex-wrap gap-2 rounded-md p-2", isEditing && "border min-h-[40px]")}>
                                     {form.getValues('access').map(p => (
                                        <Badge key={p} variant="outline" className={cn("text-sm font-normal", newlyAddedPermissions.has(p) && "border-blue-500 text-blue-500")}>
                                            {p}
                                            {isEditing && (
                                                <button type="button" onClick={() => handleRemovePermission(p)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            )}
                                        </Badge>
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}/>

                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} disabled={!isEditing || isPending} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
                    </CardContent>
                    <CardFooter className="justify-between">
                        <div>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <Button type="submit" disabled={isPending || nameStatus !== 'available'}>
                                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                    <Button variant="outline" type="button" onClick={() => { setIsEditing(false); form.reset(); setNameStatus('idle'); setNewlyAddedPermissions(new Set()); }}>
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Button type="button" onClick={() => setIsEditing(true)}>Edit</Button>
                            )}
                        </div>

                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isPending}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the permission set.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Deletion</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
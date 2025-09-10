
"use client"

import { useEffect, useState, useTransition, useRef } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from 'next/image'

import { updateUserProfile, getDisplayNameSuggestions } from "@/actions/profile"
import { useToast } from "@/hooks/use-toast"
import { uploadFile } from '@/actions/upload'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useSession } from '@/context/session-context'
import { BackButton } from '@/components/ui/back-button'
import { cn } from '@/lib/utils'
import { Check, Loader2, UploadCloud, Send } from '@/components/icons'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { Separator } from '@/components/ui/separator'

const displayFormSchema = z.object({
  displayPhoto: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  selectedDisplayName: z.string().min(1, "Please select a display name format."),
  customDisplayName: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.selectedDisplayName === 'custom' && (!data.customDisplayName || data.customDisplayName.length < 3)) {
        ctx.addIssue({
            code: "custom",
            path: ["customDisplayName"],
            message: "Custom display name must be at least 3 characters.",
        });
    }
});

type DisplayFormValues = z.infer<typeof displayFormSchema>;

const defaultAvatars = [
    "https://neupgroup.com/assets/avatar/user1.png",
    "https://neupgroup.com/assets/avatar/user2.png",
    "https://neupgroup.com/assets/avatar/user3.png",
    "https://neupgroup.com/assets/avatar/user4.png",
];


export default function DisplayInfoPage() {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { profile, accountId, refetch: refetchSession } = useSession();
    const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<DisplayFormValues>({
        resolver: zodResolver(displayFormSchema),
        defaultValues: {
            displayPhoto: "",
            selectedDisplayName: "",
            customDisplayName: "",
        },
    });

    useEffect(() => {
        if (profile) {
            form.reset({
                displayPhoto: profile.displayPhoto || "",
                selectedDisplayName: profile.displayName || "",
            });

            const fetchSuggestions = async () => {
                if (accountId) {
                    const suggestions = await getDisplayNameSuggestions(accountId);
                    setNameSuggestions(suggestions);
                }
                setLoading(false);
            }
            fetchSuggestions();
        }
    }, [profile, accountId, form]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !accountId) return;

        startTransition(async () => {
            const result = await uploadFile(file, "neup.account", `profile-photo-${accountId}`, file.name);
            if(result.success && result.url) {
                const updateResult = await updateUserProfile(accountId, { displayPhoto: result.url });
                if(updateResult.success) {
                    toast({ title: "Success", description: "Profile photo updated.", className: "bg-accent text-accent-foreground" });
                    form.setValue('displayPhoto', result.url);
                    refetchSession(); // Refetch session to update user nav
                } else {
                    toast({ variant: "destructive", title: "Error", description: updateResult.error });
                }
            } else {
                 toast({ variant: "destructive", title: "Upload Failed", description: result.error });
            }
        });
    };

    async function onSubmit(data: DisplayFormValues) {
        if (!accountId) {
            toast({ variant: "destructive", title: "Error", description: "Not authenticated." });
            return;
        }

        startTransition(async () => {
             const result = await updateUserProfile(accountId, { 
                displayPhoto: data.displayPhoto,
                displayName: data.selectedDisplayName === 'custom' ? undefined : data.selectedDisplayName,
                customDisplayNameRequest: data.selectedDisplayName === 'custom' ? data.customDisplayName : undefined,
             });

            if (result.success) {
                toast({ title: "Success", description: result.message, className: "bg-accent text-accent-foreground" });
                if(data.selectedDisplayName === 'custom') {
                    form.setValue('customDisplayName', '');
                }
                refetchSession(); // Refetch session to update user nav
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        });
    }
    
    const selectedDisplayName = form.watch('selectedDisplayName');
    const currentDisplayPhoto = form.watch('displayPhoto');

    if (loading) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <div className="space-y-8">
            <BackButton href="/manage/profile" />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Display Information</CardTitle>
                            <CardDescription>This information will be displayed publicly on your profile.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Photo</Label>
                                 <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr] items-center gap-4 rounded-lg border p-4">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <p className="text-sm text-muted-foreground">Current</p>
                                        <Avatar className="h-24 w-24 rounded-lg">
                                            <AvatarImage src={currentDisplayPhoto || undefined} alt="Current Display Photo" data-ai-hint="person" />
                                            <AvatarFallback className="rounded-lg text-3xl">
                                                {`${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="w-full">
                                        <Carousel opts={{ align: "start", loop: true }} className="w-full">
                                            <CarouselContent>
                                                {defaultAvatars.map((avatarUrl, index) => (
                                                    <CarouselItem key={index} className="basis-1/2 md:basis-1/3 lg:basis-1/4">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            className="p-0 h-auto w-full relative"
                                                            onClick={() => form.setValue('displayPhoto', avatarUrl)}
                                                        >
                                                            <Image src={avatarUrl} alt={`Default Avatar ${index + 1}`} width={100} height={100} className="rounded-lg aspect-square object-cover"/>
                                                            {currentDisplayPhoto === avatarUrl && (
                                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                                                                    <Check className="h-8 w-8 text-white" />
                                                                </div>
                                                            )}
                                                        </Button>
                                                    </CarouselItem>
                                                ))}
                                            </CarouselContent>
                                            <CarouselPrevious className="hidden md:flex" />
                                            <CarouselNext className="hidden md:flex" />
                                        </Carousel>
                                    </div>
                                    
                                     <div className="flex flex-col items-center justify-center gap-2">
                                        <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                                            {isPending ? <Loader2 className="animate-spin mr-2"/> : <UploadCloud className="mr-2"/>}
                                            Upload Photo
                                        </Button>
                                         <Input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <Separator />

                            <FormField
                                control={form.control}
                                name="selectedDisplayName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Display Name Format</FormLabel>
                                        <FormControl>
                                            <div className="flex flex-wrap gap-2">
                                                {nameSuggestions.map(name => (
                                                    <Button key={name} type="button" variant={field.value === name ? "default" : "secondary"} onClick={() => field.onChange(name)} className="relative">
                                                        {field.value === name && <Check className="absolute -left-1 -top-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                                                        {name}
                                                    </Button>
                                                ))}
                                                 <Button type="button" variant={field.value === 'custom' ? "default" : "secondary"} onClick={() => field.onChange('custom')} className="relative">
                                                    {field.value === 'custom' && <Check className="absolute -left-1 -top-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                                                    Custom...
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                             {selectedDisplayName === 'custom' && (
                                <FormField
                                    control={form.control}
                                    name="customDisplayName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Custom Display Name</FormLabel>
                                            <FormControl><Input {...field} placeholder="Enter your custom display name" /></FormControl>
                                            <FormDescription>Your request will be sent for review.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </CardContent>
                         <CardFooter>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin" /> : "Save Changes"}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

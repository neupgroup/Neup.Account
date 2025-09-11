
"use client"

import { useEffect, useState, useTransition, useRef } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from 'next/image'

import { updateUserProfile, getDisplayNameSuggestions, getPastProfilePhotos } from "@/actions/profile"
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
import { Check, Loader2, UploadCloud, Send, RefreshCw } from '@/components/icons'
import { Separator } from '@/components/ui/separator'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'

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

export default function DisplayInfoPage() {
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { profile, accountId, refetch: refetchSession } = useSession();
    const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
    const [pastPhotos, setPastPhotos] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoView, setPhotoView] = useState<'uploader' | 'carousel'>('uploader');


    const form = useForm<DisplayFormValues>({
        resolver: zodResolver(displayFormSchema),
        defaultValues: {
            displayPhoto: "",
            selectedDisplayName: "",
            customDisplayName: "",
        },
    });

    useEffect(() => {
        if (profile && accountId) {
            form.reset({
                displayPhoto: profile.displayPhoto || "",
                selectedDisplayName: profile.displayName || "",
            });

            const fetchSuggestions = async () => {
                if (accountId) {
                    const [suggestions, photos] = await Promise.all([
                        getDisplayNameSuggestions(accountId),
                        getPastProfilePhotos(accountId)
                    ]);
                    setNameSuggestions(suggestions);
                    setPastPhotos(photos);
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
            const contentId = `profile-photo-${accountId}-${Date.now()}`;
            const result = await uploadFile(file, "neup.account", contentId, file.name, accountId);
            if(result.success && result.url) {
                const updateResult = await updateUserProfile(accountId, { displayPhoto: result.url });
                if(updateResult.success) {
                    toast({ title: "Success", description: "Profile photo updated.", className: "bg-accent text-accent-foreground" });
                    form.setValue('displayPhoto', result.url);
                    setPastPhotos(prev => [result.url as string, ...prev].slice(0, 4));
                    refetchSession();
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
                refetchSession();
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
                    <CardHeader className="px-0">
                        <CardTitle>Display Information</CardTitle>
                        <CardDescription>This information will be displayed publicly on your profile.</CardDescription>
                    </CardHeader>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label>Photo</Label>
                            <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-6 rounded-lg border p-4">
                                <Avatar className="h-28 w-28 rounded-lg mx-auto md:mx-0">
                                    <AvatarImage src={currentDisplayPhoto || undefined} alt="Current Display Photo" data-ai-hint="person" />
                                    <AvatarFallback className="rounded-lg text-3xl">
                                        {`${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                
                                {photoView === 'uploader' ? (
                                    <div 
                                        className="relative flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg text-center"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                handleFileChange({ target: { files: e.dataTransfer.files } } as any);
                                            }
                                        }}
                                    >
                                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">
                                            Upload Image by Selecting or dragging an image here
                                        </p>
                                        <Button type="button" size="sm" variant="link" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                                            {isPending ? 'Uploading...' : 'Select a file'}
                                        </Button>
                                        <p className="text-sm text-muted-foreground">or <button type="button" className="text-primary underline" onClick={() => setPhotoView('carousel')}>select an image from your previous images</button></p>
                                        <Input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        <Carousel opts={{ align: "start" }} className="w-full max-w-sm mx-auto">
                                            <CarouselContent>
                                                {pastPhotos.map((photo, index) => (
                                                    <CarouselItem key={index} className="basis-1/3">
                                                        <button
                                                            type="button"
                                                            className="relative p-1 aspect-square w-full rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                            onClick={() => form.setValue('displayPhoto', photo)}
                                                        >
                                                            <Image src={photo} alt={`Past Photo ${index + 1}`} layout="fill" objectFit="cover" className="rounded-md" />
                                                            {currentDisplayPhoto === photo && (
                                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                                                                    <Check className="h-8 w-8 text-white" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    </CarouselItem>
                                                ))}
                                            </CarouselContent>
                                            <CarouselPrevious />
                                            <CarouselNext />
                                        </Carousel>
                                        <Button type="button" variant="link" className="mt-4 p-0 h-auto" onClick={() => setPhotoView('uploader')}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Upload new photo
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        
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
                            )}
                    </div>
                     <CardFooter className="px-0">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : "Save Changes"}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </div>
    )

    
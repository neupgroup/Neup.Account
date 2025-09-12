"use client"

import { useEffect, useState, useContext } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { getUserProfile, type UserProfile } from "@/lib/user"
import { updateBrandProfile } from "@/actions/profile"
import { brandProfileFormSchema } from "@/schemas/auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GeolocationContext } from '@/context/geolocation-context'

type BrandFormValues = z.infer<typeof brandProfileFormSchema>;

export function BrandProfileForm({ accountId }: { accountId: string }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const geo = useContext(GeolocationContext);

    const form = useForm<BrandFormValues>({
        resolver: zodResolver(brandProfileFormSchema),
        defaultValues: {
            nameDisplay: "",
            accountPhoto: "",
            isLegalEntity: false,
            nameLegal: "",
            registrationId: "",
            countryOfOrigin: "",
        },
    });

    const isLegalEntity = form.watch("isLegalEntity");

    useEffect(() => {
        if (!accountId) return;

        const fetchData = async () => {
            try {
                const profileData = await getUserProfile(accountId);

                if (profileData) {
                    form.reset({
                        nameDisplay: profileData.nameDisplay || "",
                        accountPhoto: profileData.accountPhoto || "",
                        isLegalEntity: profileData.isLegalEntity || false,
                        nameLegal: profileData.nameLegal || "",
                        registrationId: profileData.registrationId || "",
                        countryOfOrigin: profileData.countryOfOrigin || "",
                        dateEstablished: profileData.dateEstablished ? new Date(profileData.dateEstablished) : undefined,
                    });
                } else {
                    setError("Could not load brand profile data.");
                }
            } catch (e) {
                console.error(e);
                setError("An error occurred while fetching brand data.");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [accountId, form]);

    async function onSubmit(data: BrandFormValues) {
        const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;
        const result = await updateBrandProfile(accountId, data, locationString);
        if (result.success) {
            toast({ title: "Success", description: result.message, className: "bg-accent text-accent-foreground" });
        } else {
            let description = result.error;
            if (result.details) {
                description = Object.values(result.details.fieldErrors).flat().join(' | ');
            }
            toast({ variant: "destructive", title: "Error", description: description || "An error occurred." });
        }
    }

    if (loading) {
        return (
            <Card>
                <CardHeader><CardTitle>Brand Information</CardTitle><CardDescription>Manage your brand's public profile.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-10 w-2/3" />
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent><p className="text-destructive">{error}</p></CardContent></Card>
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card className="bg-card/50 shadow-none">
                    <CardHeader>
                        <CardTitle>Brand Information</CardTitle>
                        <CardDescription>Manage your brand's public display name and logo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-6">
                            <div className="flex-shrink-0">
                                <Label>Logo</Label>
                                <Avatar className="h-24 w-24 mt-2 rounded-lg">
                                    <AvatarImage src={form.watch('accountPhoto') || undefined} alt="Brand Logo" data-ai-hint="logo" />
                                    <AvatarFallback className="rounded-lg">
                                        {form.watch('nameDisplay')?.[0]?.toUpperCase() || 'B'}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-grow space-y-4">
                                <FormField
                                    control={form.control}
                                    name="nameDisplay"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Display Name</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="accountPhoto"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Logo URL</FormLabel>
                                            <FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 shadow-none">
                    <CardHeader>
                        <CardTitle>Legal Information</CardTitle>
                        <CardDescription>Provide legal details if your brand is a registered entity.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="isLegalEntity"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="cursor-pointer">This is a registered legal entity</FormLabel>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />

                        {isLegalEntity && (
                            <div className="grid md:grid-cols-2 gap-4 pt-4">
                                <FormField
                                    control={form.control}
                                    name="nameLegal"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Legal Name</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="registrationId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Registration Number</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="countryOfOrigin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country of Origin</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="USA">United States</SelectItem>
                                                    <SelectItem value="CAN">Canada</SelectItem>
                                                    <SelectItem value="GBR">United Kingdom</SelectItem>
                                                    <SelectItem value="AUS">Australia</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dateEstablished"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Established On</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) => date > new Date()}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}

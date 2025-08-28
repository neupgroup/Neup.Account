
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, notFound } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { Calendar } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createDependentAccount } from "@/actions/manage/accounts/dependent"
import { dependentFormSchema } from "@/schemas/dependent"
import { Label } from "@/components/ui/label"
import { parseDateString } from "@/actions/profile"
import { BackButton } from "@/components/ui/back-button"
import { checkPermissions } from "@/lib/user"

type FormData = z.infer<typeof dependentFormSchema>;

export default function CreateDependentPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [canCreate, setCanCreate] = useState<boolean | null>(null);

    const [dateInput, setDateInput] = useState<string>('');
    const [isParsingDate, setIsParsingDate] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    
    useEffect(() => {
        async function verifyPermission() {
            const hasPermission = await checkPermissions(['linked_accounts.dependent.create']);
            setCanCreate(hasPermission);
        }
        verifyPermission();
    }, []);

    const form = useForm<FormData>({
        resolver: zodResolver(dependentFormSchema),
        defaultValues: {
            firstName: "",
            middleName: "",
            lastName: "",
            customGender: "",
            neupId: "",
            password: "",
            agreement: false,
        },
    })

    const handleDateInputBlur = async () => {
        if (!dateInput) return;

        if (dateInput.length > 30) {
            form.setError("dob", { type: "manual", message: "Input must be 30 characters or less." });
            return;
        }

        const currentDate = form.getValues("dob");
        if (currentDate && dateInput === format(currentDate, 'yyyy-MM-dd')) {
            form.clearErrors('dob');
            return;
        }

        setIsParsingDate(true);
        form.clearErrors('dob');
        const result = await parseDateString(dateInput);
        setIsParsingDate(false);

        if (result.success && result.date) {
            const newDate = new Date(result.date + 'T00:00:00');
            form.setValue('dob', newDate, { shouldDirty: true, shouldValidate: true });
            setDateInput(format(newDate, 'yyyy-MM-dd'));
        } else {
            form.setError('dob', { type: 'manual', message: result.error || 'Invalid date format.' });
        }
    };

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        const result = await createDependentAccount(data);

        if (result.success) {
            toast({
                title: "Success!",
                description: "Dependent account created successfully.",
                className: "bg-accent text-accent-foreground"
            });
            router.push('/manage/accounts/dependent');
            router.refresh();
        } else {
            toast({
                variant: "destructive",
                title: "Creation Failed",
                description: result.error || "An unexpected error occurred.",
            });
            if (result.error?.includes("NeupID")) {
                form.setFocus('neupId');
            }
        }
        setIsSubmitting(false);
    }
    
    if (canCreate === null) {
        return <div>Loading...</div>; // Or a skeleton loader
    }
    if (canCreate === false) {
        return notFound();
    }


    return (
        <div className="grid gap-8">
            <BackButton href="/manage/accounts/dependent" />
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Create Dependent Account</h1>
                <p className="text-muted-foreground">
                    Set up and manage an account for someone under your care.
                </p>
            </div>
            <Form {...form}>
                <form id="register-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader><CardTitle>Basic Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input placeholder="" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Gender</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                                            <FormItem><RadioGroupItem value="male" id="gender-male" className="peer sr-only" /><Label htmlFor="gender-male" className="flex h-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary">Male</Label></FormItem>
                                            <FormItem><RadioGroupItem value="female" id="gender-female" className="peer sr-only" /><Label htmlFor="gender-female" className="flex h-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary">Female</Label></FormItem>
                                            <FormItem><RadioGroupItem value="prefer_not_to_say" id="gender-pnts" className="peer sr-only" /><Label htmlFor="gender-pnts" className="flex h-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary">Prefer not to say</Label></FormItem>
                                            <FormItem>
                                                <RadioGroupItem value="custom" id="gender-custom" className="peer sr-only" />
                                                <Label htmlFor="gender-custom" className={cn("flex h-full cursor-pointer items-center justify-between rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground", field.value === 'custom' && "border-primary")}>
                                                    <span>Custom</span>
                                                    {field.value === 'custom' && (
                                                        <FormField control={form.control} name="customGender" render={({ field: customField }) => ( <Input {...customField} placeholder="Specify" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="ml-2 h-8 w-auto flex-grow"/> )}/>
                                                    )}
                                                </Label>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="dob"
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date of birth</FormLabel>
                                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                        <div className="relative w-[240px]">
                                                <Input placeholder="YYYY-MM-DD or e.g. June 12 2002" value={dateInput} onChange={(e) => setDateInput(e.target.value)} onBlur={handleDateInputBlur} disabled={isParsingDate} className="pr-10"/>
                                            <PopoverTrigger asChild>
                                                <Button variant={"ghost"} size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Open calendar">
                                                    <Calendar className="h-4 w-4 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                        </div>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent mode="single" selected={field.value} onSelect={(date) => { if (date) { field.onChange(date); setDateInput(format(date, 'yyyy-MM-dd')); form.clearErrors('dob'); setIsPopoverOpen(false); } }} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    {isParsingDate && <FormDescription>Parsing date with AI...</FormDescription>}
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="nationality"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nationality</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="american">American</SelectItem>
                                                <SelectItem value="british">British</SelectItem>
                                                <SelectItem value="canadian">Canadian</SelectItem>
                                                <SelectItem value="australian">Australian</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Account Credentials</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={form.control} name="neupId" render={({ field }) => ( <FormItem><FormLabel>NeupID</FormLabel><FormControl><Input placeholder="johndoe" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Agreement</CardTitle></CardHeader>
                        <CardContent>
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
                                                I acknowledge that I am the parent or legal guardian and I agree to the <Link href="/manage/policies" target="_blank" className="underline text-primary">terms and conditions</Link> on behalf of the dependent.
                                            </FormLabel>
                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Creating Account..." : "Create Account"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

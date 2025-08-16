

"use client"

import { useState, useContext } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { Calendar } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { registerUser } from "@/lib/auth-actions"
import { Label } from "@/components/ui/label"
import { parseDateString } from "@/app/manage/profile/actions"
import { GeolocationContext } from "@/context/geolocation-context"

const formSchema = z.object({
    // Step 1
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    // Step 2
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"], { required_error: "Please select a gender."}),
    customGender: z.string().optional(),
    dob: z.date({ required_error: "Date of birth is required." }),
    // Step 3
    nationality: z.string().min(1, "Nationality is required"),
    // Step 4
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
    // Step 5
    password: z.string().min(8, "Password must be at least 8 characters."),
    // Step 6
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must accept the terms and conditions.",
    }),
});

type FormData = z.infer<typeof formSchema>;

const steps = [
    { id: 1, title: "Basic Details", fields: ["firstName", "middleName", "lastName"] },
    { id: 2, title: "Personal Information", fields: ["gender", "customGender", "dob"] },
    { id: 3, title: "Nationality", fields: ["nationality"] },
    { id: 4, title: "Choose your NeupID", fields: ["neupId"] },
    { id: 5, title: "Set a Password", fields: ["password"] },
    { id: 6, title: "Agreement", fields: ["agreement"] },
]

export default function RegisterPage() {
    const router = useRouter()
    const { toast } = useToast()
    const geo = useContext(GeolocationContext);
    const [currentStep, setCurrentStep] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [dateInput, setDateInput] = useState<string>('');
    const [isParsingDate, setIsParsingDate] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
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

        // Avoid re-parsing if the input matches the current valid date
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

    const handleNext = async () => {
        const fields = steps[currentStep].fields
        const output = await form.trigger(fields as (keyof FormData)[], { shouldFocus: true })
        if (!output) return

        if (currentStep < steps.length - 1) {
            setCurrentStep(step => step + 1)
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(step => step - 1)
        }
    }

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;
        try {
            const result = await registerUser({
                ...data,
                dob: data.dob.toISOString(),
                geolocation: locationString,
            });

            if (result.success) {
                router.push('/manage');
                router.refresh();
            } else {
                toast({
                    variant: "destructive",
                    title: "Registration Failed",
                    description: result.error || "An unexpected error occurred.",
                });
            }
        } catch (error) {
            console.error("Error creating user:", error);
            toast({
                variant: "destructive",
                title: "Registration Failed",
                description: "Could not create your account. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-card md:bg-background py-12 md:items-center md:py-0">
            <Card className="mx-auto max-w-lg w-full border-0 shadow-none md:border md:shadow-sm">
                <CardHeader>
                    <div className="flex justify-start items-center mb-4">
                        
                    </div>
                    <CardTitle className="text-2xl font-headline">{steps[currentStep].title}</CardTitle>
                    <CardDescription>Step {currentStep + 1} of {steps.length}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form id="register-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {currentStep === 0 && (
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>First Name</FormLabel>
                                                <FormControl><Input placeholder="John" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="middleName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Middle Name (Optional)</FormLabel>
                                                <FormControl><Input placeholder="" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="lastName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Last Name</FormLabel>
                                                <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="space-y-4">
                                     <FormField
                                        control={form.control}
                                        name="gender"
                                        render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Gender</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    className="grid grid-cols-2 gap-4"
                                                >
                                                    <FormItem>
                                                        <RadioGroupItem value="male" id="gender-male" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="gender-male"
                                                            className="flex h-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                                                        >
                                                            Male
                                                        </Label>
                                                    </FormItem>
                                                    <FormItem>
                                                        <RadioGroupItem value="female" id="gender-female" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="gender-female"
                                                            className="flex h-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                                                        >
                                                            Female
                                                        </Label>
                                                    </FormItem>
                                                    <FormItem>
                                                        <RadioGroupItem value="prefer_not_to_say" id="gender-pnts" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="gender-pnts"
                                                            className="flex h-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                                                        >
                                                            Prefer not to say
                                                        </Label>
                                                    </FormItem>
                                                    <FormItem>
                                                        <RadioGroupItem value="custom" id="gender-custom" className="peer sr-only" />
                                                        <Label
                                                            htmlFor="gender-custom"
                                                            className={cn(
                                                                "flex h-full cursor-pointer items-center justify-between rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground",
                                                                field.value === 'custom' && "border-primary"
                                                            )}
                                                        >
                                                            <span>Custom</span>
                                                            {field.value === 'custom' && (
                                                                <FormField
                                                                    control={form.control}
                                                                    name="customGender"
                                                                    render={({ field: customField }) => (
                                                                        <Input
                                                                            {...customField}
                                                                            placeholder="Specify"
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                                            className="ml-2 h-8 w-auto flex-grow"
                                                                        />
                                                                    )}
                                                                />
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
                                                     <Input
                                                        placeholder="YYYY-MM-DD or e.g. June 12 2002"
                                                        value={dateInput}
                                                        onChange={(e) => setDateInput(e.target.value)}
                                                        onBlur={handleDateInputBlur}
                                                        disabled={isParsingDate}
                                                        className="pr-10"
                                                    />
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant={"ghost"}
                                                            size="icon"
                                                            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                            aria-label="Open calendar"
                                                        >
                                                            <Calendar className="h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                </div>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <CalendarComponent
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={(date) => {
                                                            if (date) {
                                                                field.onChange(date);
                                                                setDateInput(format(date, 'yyyy-MM-dd'));
                                                                form.clearErrors('dob');
                                                                setIsPopoverOpen(false);
                                                            }
                                                        }}
                                                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            {isParsingDate && <FormDescription>Parsing date with AI...</FormDescription>}
                                            <FormMessage />
                                        </FormItem>
                                     )} />
                                </div>
                            )}

                            {currentStep === 2 && (
                                <FormField
                                    control={form.control}
                                    name="nationality"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nationality</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select your nationality" />
                                                    </SelectTrigger>
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
                            )}
                            
                            {currentStep === 3 && (
                                <FormField
                                    control={form.control}
                                    name="neupId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>NeupID</FormLabel>
                                            <FormControl><Input placeholder="johndoe" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            
                             {currentStep === 4 && (
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Password</FormLabel>
                                                <FormControl><Input type="password" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                             
                            {currentStep === 5 && (
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
                                                    I agree to the <Link href="/manage/policies" target="_blank" className="underline text-primary">terms and conditions</Link>.
                                                </FormLabel>
                                                <FormMessage />
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            )}
                        </form>
                    </Form>
                </CardContent>

                <CardFooter className="flex justify-between">
                    <Button type="button" onClick={handleBack} variant="outline" disabled={currentStep === 0}>
                        Back
                    </Button>
                    {currentStep < steps.length - 1 ? (
                        <Button type="button" onClick={handleNext}>
                            Next
                        </Button>
                    ) : (
                        <Button type="submit" form="register-form" disabled={isSubmitting}>
                            {isSubmitting ? "Creating Account..." : "Create Account"}
                        </Button>
                    )}
                </CardFooter>
                
                <div className="mt-4 text-center text-sm p-6 pt-0">
                    Already have an account?{" "}
                    <Link href="/auth/signin" className="underline text-primary">
                        Login
                    </Link>
                </div>
            </Card>
        </div>
    )
}

    
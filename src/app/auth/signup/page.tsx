
"use client"

import { useState, useContext, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { Calendar, CheckCircle2, Loader2, XCircle } from "@/components/icons"
import NProgress from 'nprogress'
import { useDebounce } from "use-debounce"


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
import { registerUser } from "@/actions/auth/register"
import { registrationSchema } from "@/schemas/auth"
import { Label } from "@/components/ui/label"
import { parseDateString } from "@/actions/profile"
import { GeolocationContext } from "@/context/geolocation-context"
import { checkNeupIdAvailability } from "@/lib/user"

const formSchema = registrationSchema.extend({
  dob: z.date().refine(
    (date) => {
      const ageDifMs = Date.now() - date.getTime();
      const ageDate = new Date(ageDifMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return age >= 16;
    },
    { message: "You must be at least 16 years old." }
  )
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
    
    const [neupIdStatus, setNeupIdStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');


    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        mode: 'onChange',
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
    
    const neupIdValue = form.watch("neupId");
    const [debouncedNeupId] = useDebounce(neupIdValue, 500);

    const { formState: { errors, isValid } } = form;
    const currentFields = steps[currentStep].fields as (keyof FormData)[];
    const isStepValid = !currentFields.some(field => errors[field]);


    useEffect(() => {
        NProgress.start();
        return () => {
            NProgress.done();
        }
    }, []);

    useEffect(() => {
        const progress = (currentStep + 1) / steps.length;
        NProgress.set(progress);
    }, [currentStep]);


    const checkAvailability = useCallback(async (id: string) => {
        const neupIdRegex = /^[a-z0-9-]{3,}$/;
        if (!neupIdRegex.test(id)) {
            setNeupIdStatus('idle');
            return;
        }
        setNeupIdStatus('checking');
        const { available } = await checkNeupIdAvailability(id);
        setNeupIdStatus(available ? 'available' : 'unavailable');
    }, []);
    
    useEffect(() => {
        if (currentStep === 3) {
            checkAvailability(debouncedNeupId);
        }
    }, [debouncedNeupId, checkAvailability, currentStep]);

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

    const handleNext = async () => {
        const output = await form.trigger(currentFields, { shouldFocus: true })
        if (!output) return
        
        if (currentStep === 3 && neupIdStatus !== 'available') {
            form.setError('neupId', { type: 'manual', message: 'This NeupID is unavailable.' });
            return;
        }

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
        NProgress.set(1.0);
        const locationString = geo?.latitude && geo?.longitude ? `${geo.latitude},${geo.longitude}` : undefined;
        try {
            const result = await registerUser({
                ...data,
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
                NProgress.set((currentStep + 1) / steps.length);
            }
        } catch (error) {
            console.error("Error creating user:", error);
            toast({
                variant: "destructive",
                title: "Registration Failed",
                description: "Could not create your account. Please try again.",
            });
             NProgress.set((currentStep + 1) / steps.length);
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleNeupIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        form.setValue('neupId', value, { shouldValidate: true });
        if(form.formState.errors.neupId) form.clearErrors('neupId');
        if(neupIdStatus !== 'idle' && neupIdStatus !== 'checking') setNeupIdStatus('idle');
    };

    const NeupIdStatusIcon = () => {
        if (neupIdStatus === 'checking') return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
        if (neupIdStatus === 'available') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        if (neupIdStatus === 'unavailable') return <XCircle className="h-5 w-5 text-destructive" />;
        return null;
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
                                                        </Label>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            {form.watch("gender") === 'custom' && (
                                                <FormField
                                                    control={form.control}
                                                    name="customGender"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Specify Gender</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} placeholder="Your gender" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
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
                                                <div className="relative w-full">
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
                                            <div className="relative">
                                                <FormControl>
                                                    <Input
                                                        placeholder="johndoe"
                                                        {...field}
                                                        onChange={handleNeupIdChange}
                                                        className="pr-10"
                                                    />
                                                </FormControl>
                                                <div className="absolute inset-y-0 right-3 flex items-center">
                                                    <NeupIdStatusIcon />
                                                </div>
                                            </div>
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
                        <Button type="button" onClick={handleNext} disabled={!isStepValid || (currentStep === 3 && neupIdStatus !== 'available')}>
                            Next
                        </Button>
                    ) : (
                        <Button type="submit" form="register-form" disabled={isSubmitting || !isStepValid}>
                            {isSubmitting ? "Creating Account..." : "Create Account"}
                        </Button>
                    )}
                </CardFooter>
                
                <div className="mt-4 text-center text-sm p-6 pt-0">
                    Already have an account?{" "}
                    <Link href="/auth/signin" className="underline text-primary">
                        Sign In
                    </Link>
                </div>
            </Card>
        </div>
    )
}

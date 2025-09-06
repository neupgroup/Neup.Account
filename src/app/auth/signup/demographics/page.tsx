
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NProgress from 'nprogress';
import { format } from "date-fns";

import { useToast } from "@/hooks/use-toast";
import { submitDemographicsStep, getSignupStepData } from "@/actions/auth/signup";
import { parseDateString } from "@/actions/profile";
import { demographicsSchema } from "@/schemas/signup";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Loader2 } from "@/components/icons";
import { cn } from "@/lib/utils";

type FormData = z.infer<typeof demographicsSchema>;

export default function DemographicsStepPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [dateInput, setDateInput] = useState<string>('');
    const [isParsingDate, setIsParsingDate] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(demographicsSchema),
        defaultValues: {
            customGender: "",
        },
    });
    
    const genderValue = form.watch("gender");

    useEffect(() => {
        async function loadData() {
            const { data } = await getSignupStepData();
            if (data) {
                let formGender = data.gender || 'prefer_not_to_say';
                let formCustomGender = "";
                if (data.gender?.startsWith('c.')) {
                    formCustomGender = data.gender.substring(2);
                    formGender = 'custom';
                }

                const dobDate = data.dob ? new Date(data.dob) : undefined;
                if (dobDate) {
                    setDateInput(format(dobDate, 'yyyy-MM-dd'));
                }

                form.reset({
                    dob: dobDate,
                    gender: formGender,
                    customGender: formCustomGender,
                    nationality: data.nationality || undefined,
                });
            }
        }
        loadData();
    }, [form]);

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
        NProgress.start();
        const result = await submitDemographicsStep(data);
        if (result.success) {
            router.push('/auth/signup/contact');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            NProgress.done();
        }
    }

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Gender</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col gap-2">
                                    <FormItem>
                                        <RadioGroupItem value="male" id="gender-male" className="peer sr-only" />
                                        <Label htmlFor="gender-male" className="flex h-12 cursor-pointer items-center justify-start rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Male</Label>
                                    </FormItem>
                                    <FormItem>
                                        <RadioGroupItem value="female" id="gender-female" className="peer sr-only" />
                                        <Label htmlFor="gender-female" className="flex h-12 cursor-pointer items-center justify-start rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Female</Label>
                                    </FormItem>
                                    <FormItem>
                                        <RadioGroupItem value="prefer_not_to_say" id="gender-pnts" className="peer sr-only" />
                                        <Label htmlFor="gender-pnts" className="flex h-12 cursor-pointer items-center justify-start rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Prefer not to say</Label>
                                    </FormItem>
                                    <FormItem>
                                        <RadioGroupItem value="custom" id="gender-custom" className="peer sr-only" />
                                        <Label htmlFor="gender-custom" className="flex h-12 cursor-pointer items-center justify-start rounded-md border-2 border-muted bg-popover p-4 font-normal hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                            <span>Custom</span>
                                        </Label>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                {genderValue === 'custom' && (
                    <FormField
                        control={form.control}
                        name="customGender"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Custom Gender</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="Please specify" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                 <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Date of birth</FormLabel>
                        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                            <div className="relative w-full">
                                <Input placeholder="YYYY-MM-DD or e.g. June 12 2002" value={dateInput} onChange={(e) => setDateInput(e.target.value)} onBlur={handleDateInputBlur} disabled={isParsingDate} className="pr-10"/>
                                <PopoverTrigger asChild>
                                    <Button variant={"ghost"} size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Open calendar"><CalendarIcon className="h-4 w-4 opacity-50" /></Button>
                                </PopoverTrigger>
                            </div>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent mode="single" selected={field.value} onSelect={(date) => { if (date) { field.onChange(date); setDateInput(format(date, 'yyyy-MM-dd')); form.clearErrors('dob'); setIsPopoverOpen(false); } }} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                            </PopoverContent>
                        </Popover>
                        {isParsingDate && <FormMessage>Parsing date with AI...</FormMessage>}
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
                                <FormControl><SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger></FormControl>
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Next
                </Button>
            </form>
        </Form>
    );
}

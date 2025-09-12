
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2, Check } from "@/components/icons";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
                let formGender = data.gender;
                let formCustomGender = "";
                if (data.gender?.startsWith('c.')) {
                    formCustomGender = data.gender.substring(2);
                    formGender = 'custom';
                }

                const dobDate = data.dateBirth ? new Date(data.dateBirth) : undefined;
                if (dobDate) {
                    setDateInput(format(dobDate, 'yyyy-MM-dd'));
                }

                form.reset({
                    dob: dobDate,
                    gender: formGender || undefined,
                    customGender: formCustomGender,
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
            router.push('/auth/signup/nationality');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            NProgress.done();
        }
    }

    const isSubmitting = form.formState.isSubmitting;
    
    const genderOptions = ["Male", "Female", "Prefer not to say", "Custom"];

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
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    className="block"
                                >
                                    <div className="border border-input rounded-lg overflow-hidden">
                                    {genderOptions.map((option) => {
                                        const value = option.toLowerCase().replace(/\s/g, '_');
                                        return (
                                            <FormItem key={value} className="m-0">
                                                <Label htmlFor={`gender-${value}`} className="flex items-center space-x-3 space-y-0 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-input last:border-b-0 has-[input:checked]:bg-primary/10">
                                                    <div className="relative flex items-center">
                                                        <RadioGroupItem value={value} id={`gender-${value}`} className="peer sr-only" />
                                                            <div className="w-5 h-5 border-2 border-primary rounded-sm flex-shrink-0 peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-white flex items-center justify-center">
                                                            <Check className="h-4 w-4 opacity-0 peer-data-[state=checked]:opacity-100" />
                                                        </div>
                                                    </div>
                                                    <span className="ml-3 font-normal">{option}</span>
                                                </Label>
                                            </FormItem>
                                        );
                                    })}
                                    </div>
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
                                <PopoverTrigger asChild>
                                    <Input
                                        placeholder="YYYY-MM-DD or e.g. June 12 2002"
                                        value={dateInput}
                                        onChange={(e) => setDateInput(e.target.value)}
                                        onBlur={handleDateInputBlur}
                                        disabled={isParsingDate || isSubmitting}
                                        className="pr-10"
                                    />
                                </PopoverTrigger>
                                {isParsingDate && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
                            </div>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent mode="single" selected={field.value} onSelect={(date) => { if (date) { field.onChange(date); setDateInput(format(date, 'yyyy-MM-dd')); form.clearErrors('dob'); setIsPopoverOpen(false); } }} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                            </PopoverContent>
                        </Popover>
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

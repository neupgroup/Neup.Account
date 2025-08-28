'use client';

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { kycFormSchema, type KycFormValues } from '@/schemas/kyc';
import { submitKyc } from './actions';
import { getUserProfile } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BackButton } from '@/components/ui/back-button';
import { Loader2, Camera, ShieldCheck, User, FileText, CheckCircle2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

function WebcamCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const {toast} = useToast();

    useEffect(() => {
        const getCameraPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({video: true});
            setHasCameraPermission(true);

            if (videoRef.current) {
            videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this app.',
            });
        }
        };

        getCameraPermission();
    }, [toast]);
    
    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            onCapture(dataUrl);
        }
    };

    return (
        <div className="space-y-2">
            <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted />
            {hasCameraPermission === false && (
                <Alert variant="destructive">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>Please allow camera access to use this feature.</AlertDescription>
                </Alert>
            )}
            <Button type="button" onClick={handleCapture} disabled={!hasCameraPermission}>
                <Camera className="mr-2 h-4 w-4" />
                Capture Selfie
            </Button>
        </div>
    );
}


export default function KycPage() {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [accountId, setAccountId] = useState<string | null>(null);

    const form = useForm<KycFormValues>({
        resolver: zodResolver(kycFormSchema),
        defaultValues: {
            fullName: '',
            dob: '',
            nationality: '',
            address: '',
            documentType: 'passport',
            documentId: '',
            documentPhoto: null,
            selfiePhoto: null,
        }
    });

    useEffect(() => {
        const fetchProfile = async () => {
            const id = await getPersonalAccountId();
            setAccountId(id);
            if(id) {
                const profile = await getUserProfile(id);
                if (profile) {
                    form.setValue('fullName', `${profile.firstName || ''} ${profile.lastName || ''}`.trim());
                    form.setValue('dob', profile.dob ? profile.dob.split('T')[0] : '');
                    form.setValue('nationality', profile.nationality || '');
                }
            }
        };
        fetchProfile();
    }, [form]);
    
    const onSubmit = (data: KycFormValues) => {
        if (!accountId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
            return;
        }

        startTransition(async () => {
            const result = await submitKyc(accountId, data);
            if (result.success) {
                setStep(4); // Move to success step
            } else {
                toast({ variant: 'destructive', title: 'Submission Failed', description: result.error });
            }
        });
    };

    const nextStep = async () => {
        let fieldsToValidate: (keyof KycFormValues)[] = [];
        if (step === 1) fieldsToValidate = ['fullName', 'dob', 'nationality', 'address'];
        if (step === 2) fieldsToValidate = ['documentType', 'documentId', 'documentPhoto', 'selfiePhoto'];

        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setStep(s => s + 1);
        }
    };
    
    const prevStep = () => setStep(s => s - 1);

    const steps = [
        { num: 1, title: 'Personal Details', icon: User },
        { num: 2, title: 'Upload Documents', icon: FileText },
        { num: 3, title: 'Review & Submit', icon: ShieldCheck },
    ];

    if (step === 4) { // Success screen
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-2xl font-bold">KYC Submitted Successfully!</h1>
                <p className="text-muted-foreground mt-2">Your information is now under review. We will notify you once the process is complete.</p>
                <Button onClick={() => router.push('/manage/profile')} className="mt-6">Back to Profile</Button>
            </div>
        )
    }

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/profile" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
                <p className="text-muted-foreground">Verify your identity to unlock all features of your account.</p>
            </div>

            <div className="flex items-center justify-center space-x-4">
                {steps.map((s, index) => (
                    <React.Fragment key={s.num}>
                        <div className="flex flex-col items-center gap-2">
                             <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                <s.icon className="h-5 w-5" />
                            </div>
                            <span className={`text-sm ${step >= s.num ? 'font-semibold' : 'text-muted-foreground'}`}>{s.title}</span>
                        </div>
                        {index < steps.length - 1 && <div className={`flex-1 h-1 rounded ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />}
                    </React.Fragment>
                ))}
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {step === 1 && (
                        <Card>
                            <CardHeader><CardTitle>Step 1: Personal Details</CardTitle><CardDescription>Please confirm your personal information.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField name="fullName" control={form.control} render={({ field }) => (<FormItem><FormLabel>Full Legal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name="dob" control={form.control} render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name="nationality" control={form.control} render={({ field }) => (<FormItem><FormLabel>Nationality</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField name="address" control={form.control} render={({ field }) => (<FormItem><FormLabel>Full Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </CardContent>
                        </Card>
                    )}

                    {step === 2 && (
                         <Card>
                            <CardHeader><CardTitle>Step 2: Document Upload</CardTitle><CardDescription>Upload a government-issued ID and a selfie.</CardDescription></CardHeader>
                            <CardContent className="space-y-6">
                                <FormField name="documentType" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel>Document Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent><SelectItem value="passport">Passport</SelectItem><SelectItem value="license">Driver's License</SelectItem><SelectItem value="national_id">National ID Card</SelectItem></SelectContent>
                                        </Select>
                                    <FormMessage /></FormItem>
                                )}/>
                                <FormField name="documentId" control={form.control} render={({ field }) => (<FormItem><FormLabel>Document ID Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                
                                <FormField name="documentPhoto" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel>Photo of Document</FormLabel><FormControl><Input type="file" accept="image/*" onChange={e => field.onChange(e.target.files?.[0] || null)} /></FormControl><FormMessage /></FormItem>
                                )}/>

                                <FormField name="selfiePhoto" control={form.control} render={({ field }) => (
                                    <FormItem><FormLabel>Selfie</FormLabel>
                                        <FormControl>
                                            <WebcamCapture onCapture={dataUrl => field.onChange(dataUrl)} />
                                        </FormControl>
                                    <FormMessage /></FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    )}
                    
                    {step === 3 && (
                        <Card>
                            <CardHeader><CardTitle>Step 3: Review & Submit</CardTitle><CardDescription>Please review your information before submitting.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <Alert>
                                    <AlertTitle>Confirmation</AlertTitle>
                                    <AlertDescription>By submitting, you confirm that the information provided is true and accurate. Any false information may result in account suspension.</AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-between">
                        {step > 1 && <Button type="button" variant="outline" onClick={prevStep}>Back</Button>}
                        {step < 3 && <Button type="button" onClick={nextStep}>Next Step</Button>}
                        {step === 3 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" disabled={isPending}>
                                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Submit for Verification
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Submit KYC Information?</AlertDialogTitle>
                                        <AlertDialogDescription>Please confirm you want to submit these details for review. This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => form.handleSubmit(onSubmit)()}>
                                            Yes, Submit
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </form>
            </Form>
        </div>
    );
}
